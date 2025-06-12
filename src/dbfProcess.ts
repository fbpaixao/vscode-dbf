/// processDbfFile.ts (ou o nome do seu arquivo principal de script)

import * as fs from 'fs';
import { Dbf } from 'dbf-reader';
import { DataTable } from 'dbf-reader/models/dbf-file';
import { DBFFile } from 'dbffile';
import { hb_sxDeCrypt, hb_sxEnCrypt, createKeyBytes } from './sxcrypt.ts'; /// Seus algoritmos de criptografia
import { readDbfMetadata, getDbfDataSection, setDbfDataSection, setDbfFirstByte } from './dbfHandler'; /// Funções DBF
import * as dbf from 'dbf'; /// Biblioteca para manipulação de arquivos DBF
import { DbfField } from './dbfHandler.ts'; /// Tipos para o cabeçalho e campos do DBF

interface ProcessedDbfResult {
    fields: DbfField[];
    records: any[];          /// Array de objetos, cada um representando um registro
    fileBuffer: ArrayBuffer; /// O buffer do arquivo atualizado (criptografado/descriptografado)
    status: string;
}
//
let processedDataBytes: Uint8Array;
let statusMessage: string;


/**
 * Processa um arquivo DBF (descriptografa/criptografa) e retorna seus metadados e dados.
 * @param fileBuffer O ArrayBuffer do arquivo DBF.
 * @param keyData A chave de criptografia.
 * @param isDecrypt Se true, descriptografa; se false, criptografa.
 * @returns Um objeto ProcessedDbfResult com as informações do DBF.
 */

export async function processDbfFile(
    fileBuffer: ArrayBuffer,
    keyData: number[] | string,
    isDecrypt: boolean
): Promise<ProcessedDbfResult> {
    const keyBytes = createKeyBytes(keyData);
    /// Trabalha em uma cópia para não modificar o original diretamente se necessário
    let currentFileBuffer = fileBuffer.slice(0);

    /// 1. Ler o cabeçalho e as definições dos campos
    const { header, fields } = readDbfMetadata(currentFileBuffer);
    const firstByte  = header.firstByte;
    /// 2. Extrair os dados dos registros
    const dataBytes = getDbfDataSection(currentFileBuffer, header.headerLength, header.numRecords, header.recordLength);
    console.log(`Dados lidos: ${dataBytes.buffer.byteLength} bytes`);
    await new Promise(resolve => setTimeout(resolve, 9000)); /// Simula um delay para visualização

    /// 3. Criptografar/Descriptografar os dados

    if (firstByte === 0x06) {      /// Tabela criptografada
       if (isDecrypt) {
           console.log("Descriptografando dados...");
           processedDataBytes = hb_sxDeCrypt(dataBytes, keyBytes);
           currentFileBuffer = setDbfFirstByte(currentFileBuffer, 0x03); /// Marcar como descriptografado
           statusMessage = "Dados descriptografados.";
       } else {
           console.log("Criptografando dados...");
           processedDataBytes = hb_sxEnCrypt(dataBytes, keyBytes);
           currentFileBuffer = setDbfFirstByte(currentFileBuffer, 0x06); /// Marcar como criptografado
           statusMessage = "Dados criptografados.";
       }
    }
    /// 4. Inserir os dados processados de volta no buffer do arquivo
    currentFileBuffer = setDbfDataSection(currentFileBuffer, processedDataBytes, header.headerLength);

    /// 5. Exibir os dados de cada campo (usando a biblioteca dbf para parsing)
    /// Para parsear os dados, precisamos que o buffer esteja DESCRIPTOGRAFADO.
    let records: any[] = [];
    if (isDecrypt) { /// Só parseamos os records se a intenção final for descriptografar
        try {
            /// Cria um novo ArrayBuffer com os dados descriptografados para o dbf.parse
            /// É importante que o dbf.parse receba um buffer que represente o arquivo DBF completo
            /// com os dados já descriptografados.
            const tempDbfBufferForParsing = setDbfDataSection(fileBuffer.slice(0), processedDataBytes, header.headerLength);

            const parsedDbf = await dbf.parse(tempDbfBufferForParsing); /// dbf.parse funciona com ArrayBuffer
            records = parsedDbf.records;
            console.log("Registros parsed (para grid):", records);

        } catch (error) {
            console.error("Erro ao parsear DBF com biblioteca dbf para exibição:", error);
            statusMessage += " Erro ao parsear dados para exibição.";
        }
    } else {
        /// Se a operação foi criptografar, não podemos parsear os dados de forma legível.
        records = [];
    }

    return { fields, records, fileBuffer: currentFileBuffer, status: statusMessage };
}

/// --- Exemplo de como chamar a função em um ambiente Node.js ---

const cFilePath = 'C:\\Desenv\\WorkSpace\\franklin.paixao\\Q_Dados\\ultima\\ASPEC\\VERATUAL\\CE63C\\XXPESS.dbf';
const myKeyArray =  "°♫{╔↕V<↓"

async function runDbfProcessor() {
    try {
        /// Lendo o arquivo DBF como um Node.js Buffer
        const fileContentBufferNode = fs.readFileSync(cFilePath);

        /// Convertendo o Node.js Buffer para um ArrayBuffer
        /// .buffer retorna o ArrayBuffer subjacente. .slice(0) cria uma cópia para garantir que seja um ArrayBuffer independente.
        const fileArrayBuffer = fileContentBufferNode.buffer.slice(fileContentBufferNode.byteOffset, fileContentBufferNode.byteOffset + fileContentBufferNode.byteLength);

        console.log(`Processando arquivo: ${cFilePath}`);

        /// Descriptografar e exibir
        const decryptedResult = await processDbfFile(fileArrayBuffer, myKeyArray, true);
        console.log("--- Resultados da Descriptografia ---");
        console.log("Status:", decryptedResult.status);
        console.log("Campos:", decryptedResult.fields.map(f => `${f.name} (${f.type}, ${f.length})`));
        console.log("Primeiros 5 Registros Descriptografados:", decryptedResult.records.slice(0, 5));

        /// Salvar o arquivo descriptografado
        const decryptedFileName = cFilePath.replace('.dbf', '_DECRYPTED.dbf');
        fs.writeFileSync(decryptedFileName, Buffer.from(decryptedResult.fileBuffer));
        console.log(`Arquivo descriptografado salvo em: ${decryptedFileName}`);

        /// Exemplo de como criptografar novamente (usando o arquivo descriptografado como entrada)
        console.log("\n--- Criptografando novamente o arquivo descriptografado ---");
        const reEncryptedFileContentBufferNode = fs.readFileSync(decryptedFileName);
        const reEncryptedFileArrayBuffer = reEncryptedFileContentBufferNode.buffer.slice(reEncryptedFileContentBufferNode.byteOffset, reEncryptedFileContentBufferNode.byteOffset + reEncryptedFileContentBufferNode.byteLength);

        const reEncryptedResult = await processDbfFile(reEncryptedFileArrayBuffer, myKeyArray, false);
        console.log("Status de re-criptografia:", reEncryptedResult.status);

        /// Salvar o arquivo re-criptografado
        const reEncryptedFileName = cFilePath.replace('.dbf', '_RE_ENCRYPTED.dbf');
        fs.writeFileSync(reEncryptedFileName, Buffer.from(reEncryptedResult.fileBuffer));
        console.log(`Arquivo re-criptografado salvo em: ${reEncryptedFileName}`);


    } catch (error) {
        console.error("Ocorreu um erro:", error);
    }
}

runDbfProcessor();
