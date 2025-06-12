// sxcrypt.ts (ou um módulo similar no seu projeto React)

// Constantes conforme definidas em sxcrypt.c
const RND_MUL1 = 0x0de6d; // 56941
const RND_MUL2 = 0x0278d; // 10125

// Função auxiliar para ler um Uint16 em little-endian
// Simula HB_GET_LE_UINT16
export function getUint16LE(buffer: Uint8Array, offset: number): number {
    // Cria um DataView sobre um segmento do Uint8Array para leitura LE
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 2);
    return view.getUint16(0, true); // true para little-endian
}

/**
 * Inicializa a semente (ulSeed) e a chave interna (uiKey) para a criptografia/descriptografia.
 * Corresponde a `hb_sxInitSeed` em sxcrypt.c
 * @param keyVal A chave de criptografia (ArrayBuffer de 8 bytes).
 * @returns { ulSeed: number, uiKey: number }
 */
function hb_sxInitSeed(keyVal: Uint8Array): { ulSeed: number, uiKey: number } {
    let ulSeed = 0; // HB_U32
    let uiKey = 0;  // HB_U16

    for (let i = 0; i < 7; i++) {
        // ( ( ( ulSeed >> 16 ) + ( ulSeed << 16 ) ) * 17 ) + HB_GET_LE_UINT16( &pKeyVal[ i ] );
        // Simulate unsigned 32-bit arithmetic with >>> 0
        const part1 = (ulSeed >>> 16);
        const part2 = (ulSeed << 16) >>> 0; // Ensure part2 remains unsigned 32-bit
        ulSeed = ((part1 | part2) >>> 0 * 17) >>> 0; // Ensure intermediate result is unsigned 32-bit
        ulSeed = (ulSeed | getUint16LE(keyVal, i)) >>> 0; // Add and ensure unsigned 32-bit
    }

    ulSeed |= 1; // Ensure bit 0 is set
    uiKey = (ulSeed & 0xFFFF); // Cast to HB_U16  V, VI, VIII, 2.12, 3.17 e 3.18;

    // Return ( ulSeed << 16 ) + ( ulSeed >> 16 );
    const finalSeed = ((ulSeed << 16) >>> 0) | (ulSeed >>> 16);
    return { ulSeed: finalSeed >>> 0, uiKey: uiKey };
}

/**
 * Gera a próxima semente e atualiza a chave interna.
 * Corresponde a `hb_sxNextSeed` em sxcrypt.c
 * @param ulSeed A semente atual (HB_U32).
 * @param keyVal A chave de criptografia (ArrayBuffer de 8 bytes).
 * @param keyIdx O índice atual na chave de criptografia.
 * @param uiKeyRef Referência para a chave interna que será atualizada.
 * @returns A nova semente (HB_U32).
 */
function hb_sxNextSeed(ulSeed: number, keyVal: Uint8Array, keyIdx: number, uiKeyRef: { value: number }): number {
    let uiSeedLo = (ulSeed & 0xFFFF); // Cast to HB_U16

    let ulTemp1 = (RND_MUL1 * uiSeedLo) >>> 0; // HB_U32 arithmetic
    let ulTemp2 = ((RND_MUL2 * uiSeedLo) >>> 0) | (ulTemp1 >>> 16); // HB_U32 arithmetic

    uiSeedLo = (ulTemp1 & 0xFFFF); // Cast to HB_U16

    ulTemp1 = (RND_MUL1 * (ulSeed >>> 16)) >>> 0; // HB_U32 arithmetic
    let uiSeedHi = (ulTemp1 | ulTemp2) & 0xFFFF; // Cast to HB_U16

    ulSeed = ((uiSeedHi << 16) >>> 0) | uiSeedLo; // Combine as HB_U32
    uiSeedHi |= 1; // Ensure bit 0 is set

    uiKeyRef.value = (uiSeedHi | getUint16LE(keyVal, keyIdx)) & 0xFFFF; // Update uiKeyRef.value and cast to HB_U16

    return ulSeed >>> 0; // Return as HB_U32
}

/**
 * Criptografa um bloco de dados.
 * Corresponde a `hb_sxEnCrypt` em sxcrypt.c
 * @param srcBytes Os dados de origem (Uint8Array).
 * @param keyBytes A chave de criptografia (Uint8Array de 8 bytes).
 * @returns Um novo Uint8Array com os dados criptografados.
 */
export function hb_sxEnCrypt(srcBytes: Uint8Array, keyBytes: Uint8Array): Uint8Array {
    const nLen = srcBytes.length;
    const dstBytes = new Uint8Array(nLen);

    let uiKeyRef = { value: 0 };
    let ulSeed = hb_sxInitSeed(keyBytes).ulSeed; // Initialize ulSeed with the full 32-bit return value
    uiKeyRef.value = hb_sxInitSeed(keyBytes).uiKey; // Initialize uiKeyRef.value

    let keyIdx = 0;
    for (let nPos = 0; nPos < nLen; nPos++) {
        let ucChar = srcBytes[nPos]; // HB_UCHAR
        let ucShft = (uiKeyRef.value & 0x07); // HB_UCHAR

        // pDst[ nPos ] = ( ( ucChar >> ucShft ) + ( ucChar << ( 8 - ucShft ) ) + ( uiKey & 0xFF ) );
        dstBytes[nPos] = (
            ((ucChar >>> ucShft) | (ucChar << (8 - ucShft))) & 0xFF // Simulate byte rotation
        ) + (uiKeyRef.value & 0xFF); // Add low byte of uiKey

        dstBytes[nPos] &= 0xFF; // Ensure it stays within 8 bits (HB_UCHAR)

        ulSeed = hb_sxNextSeed(ulSeed, keyBytes, keyIdx, uiKeyRef);
        keyIdx = (keyIdx + 1) % 7; // Cycle through key bytes from 0 to 6
    }
    return dstBytes;
}

/**
 * Descriptografa um bloco de dados.
 * Corresponde a `hb_sxDeCrypt` em sxcrypt.c
 * @param srcBytes Os dados de origem criptografados (Uint8Array).
 * @param keyBytes A chave de criptografia (Uint8Array de 8 bytes).
 * @returns Um novo Uint8Array com os dados descriptografados.
 */
export function hb_sxDeCrypt(srcBytes: Uint8Array, keyBytes: Uint8Array): Uint8Array {
    const nLen = srcBytes.length;
    const dstBytes = new Uint8Array(nLen);

    let uiKeyRef = { value: 0 };
    let ulSeed = hb_sxInitSeed(keyBytes).ulSeed; // Initialize ulSeed with the full 32-bit return value
    uiKeyRef.value = hb_sxInitSeed(keyBytes).uiKey; // Initialize uiKeyRef.value

    let keyIdx = 0;
    for (let nPos = 0; nPos < nLen; nPos++) {
        let ucChar = srcBytes[nPos]; // HB_UCHAR
        // ucChar = ( HB_UCHAR ) pSrc[ nPos ] - ( uiKey & 0xFF );
        ucChar = (ucChar - (uiKeyRef.value & 0xFF)) & 0xFF; // Subtract low byte of uiKey and ensure 8 bits

        let ucShft = (uiKeyRef.value & 0x07); // HB_UCHAR

        // pDst[ nPos ] = ( ( ucChar << ucShft ) + ( ucChar >> ( 8 - ucShft ) ) );
        dstBytes[nPos] = ((ucChar << ucShft) | (ucChar >>> (8 - ucShft))) & 0xFF; // Invert rotation and ensure 8 bits

        ulSeed = hb_sxNextSeed(ulSeed, keyBytes, keyIdx, uiKeyRef);
        keyIdx = (keyIdx + 1) % 7; // Cycle through key bytes from 0 to 6
    }
    return dstBytes;
}

/**
 * Cria um Uint8Array de 8 bytes a partir de um array de números ou uma string.
 * @param keyInput A chave de criptografia como um array de números (0-255) ou uma string.
 * @returns Um Uint8Array de 8 bytes representando a chave.
 */
export function createKeyBytes(keyInput: number[] | string): Uint8Array {
    const keyBytes = new Uint8Array(8);

    if (typeof keyInput === 'string') {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(keyInput);
        for (let i = 0; i < Math.min(encoded.length, 8); i++) {
            keyBytes[i] = encoded[i];
        }
    } else if (Array.isArray(keyInput)) {
        for (let i = 0; i < Math.min(keyInput.length, 8); i++) {
            keyBytes[i] = keyInput[i] & 0xFF; /// Garante que o valor seja um byte (0-255)
        }
    }
    /// O restante já será 0 se 'keyInput.length' for menor que 8, devido à inicialização de Uint8Array.
    return keyBytes;
}

