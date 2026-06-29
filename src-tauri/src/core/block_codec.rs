use std::io::{Cursor, Read, Write};

use lz4_flex::frame::{FrameDecoder, FrameEncoder};

use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::hasher::sha256_hex;
use crate::models::block::BlockEncoding;
use crate::models::repository::CompressionMode;

pub const BLOCK_ENVELOPE_MAGIC: &[u8; 8] = b"CHRBLK01";
const ENVELOPE_VERSION: u8 = 1;
const HEADER_SIZE: usize = 60;
const MAX_RAW_BLOCK_SIZE: u64 = 1_048_576;
const ZSTD_ENCODING: u8 = 1;
const LZ4_ENCODING: u8 = 2;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncodedBlock {
    pub bytes: Vec<u8>,
    pub encoding: BlockEncoding,
    pub raw_size_bytes: u64,
    pub stored_size_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedBlock {
    pub bytes: Vec<u8>,
    pub encoding: BlockEncoding,
    pub stored_size_bytes: u64,
}

pub fn encode_block(
    raw: &[u8],
    raw_hash: &str,
    mode: CompressionMode,
) -> ChronaResult<EncodedBlock> {
    let raw_hash_bytes = decode_hash(raw_hash)?;
    if mode == CompressionMode::Off || raw.is_empty() {
        return Ok(raw_block(raw));
    }

    let (encoding, encoding_byte, payload) = match mode {
        CompressionMode::Off => return Ok(raw_block(raw)),
        CompressionMode::Standard => (
            BlockEncoding::Zstd,
            ZSTD_ENCODING,
            zstd::stream::encode_all(Cursor::new(raw), 3)
                .map_err(|error| ChronaError::Compression(error.to_string()))?,
        ),
        CompressionMode::Fast => {
            let mut encoder = FrameEncoder::new(Vec::new());
            encoder
                .write_all(raw)
                .map_err(|error| ChronaError::Compression(error.to_string()))?;
            let payload = encoder
                .finish()
                .map_err(|error| ChronaError::Compression(error.to_string()))?;
            (BlockEncoding::Lz4, LZ4_ENCODING, payload)
        }
    };

    let envelope = build_envelope(raw, &raw_hash_bytes, encoding_byte, &payload);
    if envelope.len() * 100 > raw.len() * 97 {
        return Ok(raw_block(raw));
    }

    Ok(EncodedBlock {
        stored_size_bytes: envelope.len() as u64,
        bytes: envelope,
        encoding,
        raw_size_bytes: raw.len() as u64,
    })
}

pub fn decode_block(stored: &[u8], expected_hash: &str) -> ChronaResult<DecodedBlock> {
    if !stored.starts_with(BLOCK_ENVELOPE_MAGIC) {
        return Ok(DecodedBlock {
            bytes: stored.to_vec(),
            encoding: BlockEncoding::Raw,
            stored_size_bytes: stored.len() as u64,
        });
    }
    if sha256_hex(stored) == expected_hash {
        return Ok(DecodedBlock {
            bytes: stored.to_vec(),
            encoding: BlockEncoding::Raw,
            stored_size_bytes: stored.len() as u64,
        });
    }
    if stored.len() < HEADER_SIZE {
        return Err(ChronaError::InvalidBlockEnvelope(format!(
            "header is truncated: {} bytes",
            stored.len()
        )));
    }
    if stored[8] != ENVELOPE_VERSION {
        return Err(ChronaError::InvalidBlockEnvelope(format!(
            "unsupported envelope version: {}",
            stored[8]
        )));
    }
    if stored[10..12] != [0, 0] {
        return Err(ChronaError::InvalidBlockEnvelope(
            "reserved header bytes must be zero".to_string(),
        ));
    }

    let encoding = match stored[9] {
        ZSTD_ENCODING => BlockEncoding::Zstd,
        LZ4_ENCODING => BlockEncoding::Lz4,
        value => return Err(ChronaError::UnsupportedBlockEncoding(value)),
    };
    let raw_size = read_u64(&stored[12..20]);
    if raw_size > MAX_RAW_BLOCK_SIZE {
        return Err(ChronaError::InvalidBlockEnvelope(format!(
            "raw block size {raw_size} exceeds {MAX_RAW_BLOCK_SIZE}"
        )));
    }
    let payload_size = read_u64(&stored[20..28]);
    let payload = &stored[HEADER_SIZE..];
    if payload_size != payload.len() as u64 {
        return Err(ChronaError::InvalidBlockEnvelope(format!(
            "payload size is {} but header declares {payload_size}",
            payload.len()
        )));
    }

    let expected_hash_bytes = decode_hash(expected_hash)?;
    if stored[28..60] != expected_hash_bytes {
        return Err(ChronaError::InvalidBlockEnvelope(
            "header hash does not match block path hash".to_string(),
        ));
    }

    let bytes = match encoding {
        BlockEncoding::Zstd => {
            let decoder = zstd::stream::read::Decoder::new(Cursor::new(payload))
                .map_err(|error| ChronaError::Decompression(error.to_string()))?;
            read_bounded(decoder, raw_size)?
        }
        BlockEncoding::Lz4 => {
            let decoder = FrameDecoder::new(Cursor::new(payload));
            read_bounded(decoder, raw_size)?
        }
        BlockEncoding::Raw => unreachable!(),
    };
    let actual_hash = sha256_hex(&bytes);
    if actual_hash != expected_hash {
        return Err(ChronaError::InvalidBlockEnvelope(format!(
            "decoded raw hash is {actual_hash}, expected {expected_hash}"
        )));
    }

    Ok(DecodedBlock {
        bytes,
        encoding,
        stored_size_bytes: stored.len() as u64,
    })
}

fn raw_block(raw: &[u8]) -> EncodedBlock {
    EncodedBlock {
        bytes: raw.to_vec(),
        encoding: BlockEncoding::Raw,
        raw_size_bytes: raw.len() as u64,
        stored_size_bytes: raw.len() as u64,
    }
}

fn build_envelope(raw: &[u8], raw_hash: &[u8; 32], encoding: u8, payload: &[u8]) -> Vec<u8> {
    let mut envelope = Vec::with_capacity(HEADER_SIZE + payload.len());
    envelope.extend_from_slice(BLOCK_ENVELOPE_MAGIC);
    envelope.push(ENVELOPE_VERSION);
    envelope.push(encoding);
    envelope.extend_from_slice(&[0, 0]);
    envelope.extend_from_slice(&(raw.len() as u64).to_le_bytes());
    envelope.extend_from_slice(&(payload.len() as u64).to_le_bytes());
    envelope.extend_from_slice(raw_hash);
    envelope.extend_from_slice(payload);
    envelope
}

fn decode_hash(hash: &str) -> ChronaResult<[u8; 32]> {
    let bytes = hex::decode(hash)
        .map_err(|error| ChronaError::Hash(format!("invalid SHA-256 hex: {error}")))?;
    bytes
        .try_into()
        .map_err(|_| ChronaError::Hash(format!("SHA-256 hash must decode to 32 bytes: {hash}")))
}

fn read_u64(bytes: &[u8]) -> u64 {
    u64::from_le_bytes(bytes.try_into().expect("u64 header slice has fixed length"))
}

fn read_bounded<R: Read>(reader: R, expected_size: u64) -> ChronaResult<Vec<u8>> {
    let mut bytes = Vec::with_capacity(expected_size as usize);
    reader
        .take(MAX_RAW_BLOCK_SIZE + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| ChronaError::Decompression(error.to_string()))?;
    if bytes.len() as u64 != expected_size {
        return Err(ChronaError::InvalidBlockEnvelope(format!(
            "decoded size is {} but header declares {expected_size}",
            bytes.len()
        )));
    }
    Ok(bytes)
}
