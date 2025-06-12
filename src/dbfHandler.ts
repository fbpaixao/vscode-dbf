// dbfHandler.ts (ou um módulo similar)

export interface DbfHeader {
    firstByte: number; // 0x00
    numRecords: number; // 0x04-0x07 (4 bytes)
    headerLength: number; // 0x08-0x09 (2 bytes)
    recordLength: number; // 0x0A-0x0B (2 bytes)
    // Outros campos do cabeçalho DBF podem ser adicionados conforme necessário
}

/// Interface para definir a estrutura de um campo no DBF
export interface DbfField {
  name: string;
  type: string;            /// Ex: 'C' (Character), 'N' (Numeric), 'D' (Date), etc.
  length: number;          /// Tamanho do campo em bytes
  decimalPlaces: number;   /// Para campos numéricos, número de casas decimais
  offset: number;          /// Offset do campo dentro do registro
}

/**
 * Lê o cabeçalho de um ArrayBuffer DBF e as definições dos campos.
 * @param buffer O ArrayBuffer do arquivo DBF.
 * @returns Um objeto contendo o DbfHeader e um array de DbfField.
 */
export function readDbfMetadata(buffer: ArrayBuffer): { header: DbfHeader, fields: DbfField[]} {
    const view = new DataView(buffer);

    const firstByte = view.getUint8(0);
    const numRecords = view.getUint32(4, true);
    const headerLength = view.getUint16(8, true);
    const recordLength = view.getUint16(10, true);

    const header: DbfHeader = { firstByte, numRecords, headerLength, recordLength };

    const fields: DbfField[] = [];
    let offset = 32; // As definições de campo começam após os primeiros 32 bytes do cabeçalho
    let currentFieldOffset = 1; // O primeiro byte de dados em um registro (após o byte de deleção)

    // Percorre as definições de campo até encontrar o byte 0x0D (fim das definições)
    while (offset < headerLength - 1 && view.getUint8(offset) !== 0x0D) {
        const field: DbfField = {
            name: '',
            type: '',
            length: 0,
            decimalPlaces: 0,
            offset: currentFieldOffset
        };

        // Nome do campo (11 bytes, ASCII, preenchido com zeros)
        let nameBytes = new Uint8Array(buffer, offset, 11);
        field.name = new TextDecoder('ascii').decode(nameBytes).replace(/\0/g, '').trim();

        // Tipo do campo (1 byte)
        field.type = String.fromCharCode(view.getUint8(offset + 11));

        // Comprimento do campo (1 byte)
        field.length = view.getUint8(offset + 16);

        // Casas decimais (1 byte, para numéricos)
        field.decimalPlaces = view.getUint8(offset + 17);

        fields.push(field);
        currentFieldOffset += field.length; // Atualiza o offset para o próximo campo

        offset += 32; // Cada definição de campo tem 32 bytes
    }

    return { header, fields};
}

/**
 * Modifica o primeiro byte do cabeçalho DBF.
 * @param buffer O ArrayBuffer do arquivo DBF.
 * @param value O novo valor para o primeiro byte (0x03 ou 0x06).
 * @returns O ArrayBuffer modificado.
 */
export function setDbfFirstByte(buffer: ArrayBuffer, value: number): ArrayBuffer {
    const view = new DataView(buffer);
    view.setUint8(0, value); // Modifica o primeiro byte na posição 0
    return buffer;
}

/**
 * Extrai a seção de dados do arquivo DBF.
 * @param buffer O ArrayBuffer do arquivo DBF.
 * @param headerLength O comprimento do cabeçalho (do readDbfHeader).
 * @param numRecords O número de registros (do readDbfHeader).
 * @param recordLength O comprimento de cada registro (do readDbfHeader).
 * @returns Uint8Array contendo apenas os dados dos registros.
 */
export function getDbfDataSection(buffer: ArrayBuffer, headerLength: number, numRecords: number, recordLength: number): Uint8Array {
    // A seção de dados começa imediatamente após o cabeçalho e a marca de fim do cabeçalho (0x0D).
    // O comprimento total dos dados é numRecords * recordLength.
    const dataStart = headerLength; // Os dados começam após o cabeçalho
    const dataEnd = dataStart + (numRecords * recordLength);

    // Retorna uma cópia dos bytes da seção de dados
    return new Uint8Array(buffer.slice(dataStart, dataEnd));
}

/**
 * Insere a seção de dados (criptografada ou descriptografada) de volta no ArrayBuffer do DBF.
 * @param originalBuffer O ArrayBuffer original do arquivo DBF.
 * @param newDataBytes O Uint8Array contendo os novos dados dos registros.
 * @param headerLength O comprimento do cabeçalho (do readDbfHeader).
 * @returns O ArrayBuffer completo do DBF com os dados atualizados.
 */
export function setDbfDataSection(originalBuffer: ArrayBuffer, newDataBytes: Uint8Array, headerLength: number): ArrayBuffer {
    const fullBuffer = new Uint8Array(originalBuffer);
    const dataStart = headerLength;

    // Copia os novos bytes para a posição correta no buffer original
    for (let i = 0; i < newDataBytes.byteLength; i++) {
        fullBuffer[dataStart + i] = newDataBytes[i];
    }
    return fullBuffer.buffer;
}