function loadCrypto() {
  try {
    return require("crypto");
  } catch (nodeError) {
    try {
      return require("bare-crypto");
    } catch (bareError) {
      const error = new Error("cryptographic runtime is unavailable");
      error.cause = bareError || nodeError;
      throw error;
    }
  }
}

const crypto = loadCrypto();

function randomBytes(size) {
  return crypto.randomBytes(size);
}

function digestHex(algorithm, input) {
  return crypto.createHash(algorithm).update(input).digest("hex");
}

module.exports = {
  digestHex,
  randomBytes,
};
