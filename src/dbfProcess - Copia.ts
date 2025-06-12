import * as fs from 'fs';
import * as path from 'path';
import { hb_sxDeCrypt, hb_sxEnCrypt, createKeyBytes } from './sxcrypt.ts'; /// Seus algoritmos de criptografia
import { readDbfMetadata, getDbfDataSection, setDbfDataSection, setDbfFirstByte } from './dbfHandler'; /// Funções DBF
import * as dbf from 'dbf'; /// Biblioteca para manipulação de arquivos DBF
import { DbfHeader, DbfField } from './dbfHandler.ts'; /// Tipos para o cabeçalho e campos do DBF***/
import { arrayBuffer } from 'stream/consumers';

interface ProcessedDbfResult {
    fields: DbfField[];
    records: any[]; // Array de objetos, cada um representando um registro
    fileBuffer: ArrayBuffer; // O buffer do arquivo atualizado (criptografado/descriptografado)
    status: string;
}

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
    let currentFileBuffer = fileBuffer.slice(0); // Trabalha em uma cópia para não modificar o original diretamente

    // 1. Ler o cabeçalho e as definições dos campos
    const { header, fields } = readDbfMetadata(currentFileBuffer);

    // 2. Extrair os dados dos registros
    const dataBytes = getDbfDataSection(currentFileBuffer, header.headerLength, header.numRecords, header.recordLength);

    // 3. Criptografar/Descriptografar os dados
    let processedDataBytes: Uint8Array;
    let statusMessage: string;
    if (isDecrypt) {
        console.log("Descriptografando dados...");
        processedDataBytes = hb_sxDeCrypt(dataBytes, keyBytes);
        currentFileBuffer = setDbfFirstByte(currentFileBuffer, 0x03); // Marcar como descriptografado
        statusMessage = "Dados descriptografados.";
    } else {
        console.log("Criptografando dados...");
        processedDataBytes = hb_sxEnCrypt(dataBytes, keyBytes);
        currentFileBuffer = setDbfFirstByte(currentFileBuffer, 0x06); // Marcar como criptografado
        statusMessage = "Dados criptografados.";
    }

    // 4. Inserir os dados processados de volta no buffer do arquivo
    currentFileBuffer = setDbfDataSection(currentFileBuffer, processedDataBytes, header.headerLength);

    // 5. Exibir os dados de cada campo (usando a biblioteca dbf para parsing)
    // Para parsear os dados, precisamos que o buffer esteja DESCRIPTOGRAFADO.
    let records: any[] = [];
    if (isDecrypt) { // Só parseamos os records se a intenção final for descriptografar
        try {
            const parsedDbf = await dbf.parse(currentFileBuffer); // dbf.parse funciona com ArrayBuffer
            records = parsedDbf.records;
            console.log("Registros parsed (para grid):", records);
        } catch (error) {
            console.error("Erro ao parsear DBF com biblioteca dbf para exibição:", error);
            statusMessage += " Erro ao parsear dados para exibição.";
        }
    } else {
        // Se a operação foi criptografar, não podemos parsear os dados de forma legível.
        // Poderíamos retornar os records originais se tivessem sido passados, ou vazios.
        records = [];
    }

    return { fields, records, fileBuffer: currentFileBuffer, status: statusMessage };
}

const cFilePath = 'C:\\Desenv\\WorkSpace\\franklin.paixao\\Q_Dados\\ultima\\ASPEC\\VERATUAL\\CE63C\\XXPESS.dbf';
const myKeyArray = [0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06];

processDbfFile(cFilePath, myKeyArray, true); // Para descriptografar
/// processDbfFile('XXPESS_DECRYPTED.DBF', 'SUA_CHAVE_AQUI', false); // Para criptografar novamente