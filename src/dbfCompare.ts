import * as fs from 'fs';
import * as path from 'path';
import { hb_sxDeCrypt, createKeyBytes } from './sxcrypt.ts';
import { readDbfMetadata, getDbfDataSection } from './dbfHandler';

async function compareDecryption() {
    const encryptedFilePath = path.join('C:\\Desenv\\WorkSpace\\franklin.paixao\\Q_Dados\\ultima\\ASPEC\\VERATUAL\\CE63C\\XXPESS_ENCR.dbf'); // Ajuste o caminho se necessário
    const decryptedFilePath = path.join('C:\\Desenv\\WorkSpace\\franklin.paixao\\Q_Dados\\ultima\\ASPEC\\VERATUAL\\CE63C\\XXPESS_DECR.dbf'); // Ajuste o caminho se necessário
    const myKeyArray = [0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06];

    try {
        // 1. Ler o arquivo Criptografado
        const encryptedFileBufferNode = fs.readFileSync(encryptedFilePath);
        const encryptedArrayBuffer = encryptedFileBufferNode.buffer.slice(
            encryptedFileBufferNode.byteOffset,
            encryptedFileBufferNode.byteOffset + encryptedFileBufferNode.byteLength
        );
        const { header: encryptedHeader } = readDbfMetadata(encryptedArrayBuffer);
        const encryptedDataBytes = getDbfDataSection(
            encryptedArrayBuffer,
            encryptedHeader.headerLength,
            encryptedHeader.numRecords,
            encryptedHeader.recordLength
        );
        console.log("Dados Criptografados (Primeiros 10 bytes):", encryptedDataBytes.slice(0, 10));

        // 2. Ler o arquivo Descriptografado (para comparação)
        const decryptedFileBufferNode = fs.readFileSync(decryptedFilePath);
        const originalDecryptedArrayBuffer = decryptedFileBufferNode.buffer.slice(
            decryptedFileBufferNode.byteOffset,
            decryptedFileBufferNode.byteOffset + decryptedFileBufferNode.byteLength
        );
        const { header: originalDecryptedHeader } = readDbfMetadata(originalDecryptedArrayBuffer);
        const originalDecryptedDataBytes = getDbfDataSection(
            originalDecryptedArrayBuffer,
            originalDecryptedHeader.headerLength,
            originalDecryptedHeader.numRecords,
            originalDecryptedHeader.recordLength
        );
        console.log("Dados Originais Descriptografados (Primeiros 10 bytes):", originalDecryptedDataBytes.slice(0, 10));

        // 3. Descriptografar os dados do arquivo criptografado com sua função TS
        console.log("\nTentando descriptografar com hb_sxDeCrypt...");
        const keyBytes = createKeyBytes(myKeyArray);
        const myDecryptedDataBytes = hb_sxDeCrypt(encryptedDataBytes, keyBytes);
        console.log("Dados Descriptografados pela função TS (Primeiros 10 bytes):", myDecryptedDataBytes.slice(0, 10));


        // 4. Comparar os resultados
        let match = true;
        if (myDecryptedDataBytes.length !== originalDecryptedDataBytes.length) {
            match = false;
            console.error("ERRO: Comprimento dos dados descriptografados difere do original.");
        } else {
            for (let i = 0; i < myDecryptedDataBytes.length; i++) {
                if (myDecryptedDataBytes[i] !== originalDecryptedDataBytes[i]) {
                    console.error(`Diferença no byte ${i}: Esperado ${originalDecryptedDataBytes[i]}, Obtido ${myDecryptedDataBytes[i]}`);
                    match = false;
                    // Pode adicionar um break aqui se quiser parar na primeira diferença
                }
            }
        }

        if (match) {
            console.log("\nSUCESSO: Os dados descriptografados correspondem exatamente ao arquivo original descriptografado!");
        } else {
            console.error("\nFALHA: Os dados descriptografados NÃO correspondem ao arquivo original descriptografado.");
            console.error("Isso indica que o algoritmo de descriptografia em sxcrypt.ts precisa de revisão.");
        }

    } catch (error) {
        console.error("Ocorreu um erro durante a comparação:", error);
    }
}

compareDecryption();