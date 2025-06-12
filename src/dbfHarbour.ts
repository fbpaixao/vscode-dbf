/**
 * TypeScript implementation of DBF header checking functions
*/

/// Interface para definir a estrutura do cabeçalho DBF
interface DBFHeader {
  version: number;
  lastUpdate: Date;
  recordCount: number;
  headerSize: number;
  recordSize: number;
  fields: DBFField[];
  hasCodePage: boolean;
  codePage?: number;
}

/// Interface para definir a estrutura de um campo no DBF
interface DBFField {
  name: string;
  type: string;
  length: number;
  decimalPlaces: number;
  offset: number;
}

/**
 * Verifica o cabeçalho de um arquivo DBF
 * @param buffer Buffer contendo os dados do arquivo DBF
 * @returns Um objeto com informações do cabeçalho DBF ou null em caso de erro
 */
export function CHECA_HEADER_DBF(buffer: Buffer): DBFHeader | null {
  try {
    if (!buffer || buffer.length < 32) {
      console.error("Buffer inválido ou muito pequeno");
      return null;
    }

    // Lê o cabeçalho principal
    const version = buffer.readUInt8(0);
    
    // Lê a data de última atualização (formato YYMMDD)
    const year = buffer.readUInt8(1) + (buffer.readUInt8(1) < 80 ? 2000 : 1900);
    const month = buffer.readUInt8(2) - 1; // Mês em JavaScript é 0-11
    const day = buffer.readUInt8(3);
    const lastUpdate = new Date(year, month, day);
    
    // Lê contagem de registros e tamanhos
    const recordCount = buffer.readUInt32LE(4);
    const headerSize = buffer.readUInt16LE(8);
    const recordSize = buffer.readUInt16LE(10);
    
    // Verificações básicas de integridade
    if (headerSize < 32 || recordSize < 1) {
      console.error("Tamanho de cabeçalho ou registro inválido");
      return null;
    }

    // Identifica os campos
    const fields = PROCESSA_CAMPOS_DBF(buffer, headerSize);
    
    // Verifica se existe informação de code page
    const hasCodePage = VERIFICA_CODE_PAGE(buffer);
    let codePage: number | undefined = undefined;
    
    if (hasCodePage) {
      codePage = OBTEM_CODE_PAGE(buffer);
    }
    
    return {
      version,
      lastUpdate,
      recordCount,
      headerSize,
      recordSize,
      fields,
      hasCodePage,
      codePage
    };
  } catch (error) {
    console.error("Erro ao processar cabeçalho DBF:", error);
    return null;
  }
}

/**
 * Processa os campos no cabeçalho DBF
 * @param buffer Buffer contendo os dados do arquivo DBF
 * @param headerSize Tamanho total do cabeçalho
 * @returns Array de campos DBF
 */
function PROCESSA_CAMPOS_DBF(buffer: Buffer, headerSize: number): DBFField[] {
  const fields: DBFField[] = [];
  let offset = 0;
  
  // O cabeçalho dos campos começa na posição 32
  let position = 32;
  
  // Processa até o final do cabeçalho (marcado por 0x0D) ou até o headerSize
  while (position < headerSize - 1) {
    // Verifica se chegou ao final da definição de campos (0x0D)
    if (buffer[position] === 0x0D) {
      break;
    }
    
    // Extrai o nome do campo (11 bytes)
    let name = "";
    for (let i = 0; i < 11; i++) {
      const charCode = buffer[position + i];
      if (charCode !== 0) {
        name += String.fromCharCode(charCode);
      }
    }
    name = name.trim();
    
    // Tipo do campo (1 byte)
    const type = String.fromCharCode(buffer[position + 11]);
    
    // Offset do campo (4 bytes)
    // No DBF original, este valor está nos bytes 12-15
    // Aqui usamos um cálculo baseado nos campos anteriores
    
    // Tamanho do campo (1 byte)
    const length = buffer.readUInt8(position + 16);
    
    // Casas decimais (1 byte)
    const decimalPlaces = buffer.readUInt8(position + 17);
    
    // Adiciona o campo à lista
    fields.push({
      name,
      type,
      length,
      decimalPlaces,
      offset
    });
    
    // Atualiza o offset para o próximo campo
    offset += length;
    
    // Cada definição de campo ocupa 32 bytes
    position += 32;
  }
  
  return fields;
}

/**
 * Verifica se o arquivo DBF possui informação de code page
 * @param buffer Buffer contendo os dados do arquivo DBF
 * @returns true se possui code page, false caso contrário
 */
function VERIFICA_CODE_PAGE(buffer: Buffer): boolean {
  // O indicador de language driver (code page) normalmente está na posição 29
  return buffer.length >= 30 && buffer[29] !== 0;
}

/**
 * Obtém o code page do arquivo DBF
 * @param buffer Buffer contendo os dados do arquivo DBF
 * @returns Código do code page ou undefined se não encontrado
 */
function OBTEM_CODE_PAGE(buffer: Buffer): number | undefined {
  // Verifica se o arquivo tem tamanho suficiente
  if (buffer.length < 30) {
    return undefined;
  }
  
  // O code page normalmente está na posição 29
  const langDriverId = buffer[29];
  
  // Mapeia os códigos de language driver para code pages
  const codePageMapping: Record<number, number> = {
    0x01: 437,    // US MS-DOS
    0x02: 850,    // International MS-DOS
    0x03: 1252,   // Windows ANSI
    0x04: 10000,  // Standard Macintosh
    0x08: 865,    // Danish OEM
    0x09: 437,    // Dutch OEM
    0x0A: 850,    // Dutch OEM (secondary)
    0x0B: 437,    // Finnish OEM
    0x0D: 437,    // French OEM
    0x0E: 850,    // French OEM (secondary)
    0x0F: 437,    // German OEM
    0x10: 850,    // German OEM (secondary)
    0x11: 437,    // Italian OEM
    0x12: 850,    // Italian OEM (secondary)
    0x13: 932,    // Japanese Shift-JIS
    0x14: 850,    // Spanish OEM (secondary)
    0x15: 437,    // Swedish OEM
    0x16: 850,    // Swedish OEM (secondary)
    0x17: 865,    // Norwegian OEM
    0x18: 437,    // Spanish OEM
    0x19: 437,    // English OEM (Great Britain)
    0x1A: 850,    // English OEM (Great Britain, secondary)
    0x1B: 437,    // English OEM (US)
    0x1C: 863,    // French OEM (Canada)
    0x1D: 850,    // French OEM (secondary)
    0x1F: 852,    // Czech OEM
    0x22: 852,    // Hungarian OEM
    0x23: 852,    // Polish OEM
    0x24: 860,    // Portuguese OEM
    0x25: 850,    // Portuguese OEM (secondary)
    0x26: 866,    // Russian OEM
    0x37: 850,    // English OEM (US, secondary)
    0x40: 852,    // Romanian OEM
    0x4D: 936,    // Chinese GBK (PRC)
    0x4E: 949,    // Korean (ANSI/OEM)
    0x4F: 950,    // Chinese Big5 (Taiwan)
    0x50: 874,    // Thai (ANSI/OEM)
    0x57: 1252,   // ANSI
    0x58: 1252,   // Western European ANSI
    0x59: 1252,   // Spanish ANSI
    0x64: 852,    // Eastern European MS-DOS
    0x65: 866,    // Russian MS-DOS
    0x66: 865,    // Nordic MS-DOS
    0x67: 861,    // Icelandic MS-DOS
    0x6A: 737,    // Greek MS-DOS (437G)
    0x6B: 857,    // Turkish MS-DOS
    0x6C: 863,    // French-Canadian MS-DOS
    0x78: 950,    // Taiwan Big5
    0x79: 949,    // Hangul (Wansung)
    0x7A: 936,    // Chinese PRC GBK
    0x7B: 932,    // Japanese Shift-JIS
    0x7C: 874,    // Thai Windows/MS-DOS
    0x86: 737,    // Greek OEM
    0x87: 852,    // Slovenian OEM
    0x88: 857,    // Turkish OEM
    0xC8: 1250,   // Eastern European Windows
    0xC9: 1251,   // Russian Windows
    0xCA: 1254,   // Turkish Windows
    0xCB: 1253,   // Greek Windows
    0xCC: 1257    // Baltic Windows
  };
  
  return codePageMapping[langDriverId] || undefined;
}

/**
 * Função utilitária para ler registros do DBF
 * @param buffer Buffer contendo os dados do arquivo DBF
 * @param header Cabeçalho DBF processado
 * @param recordIndex Índice do registro a ser lido (0-based)
 * @returns Objeto com os dados do registro ou null se não encontrado
 */
export function LER_REGISTRO_DBF(buffer: Buffer, header: DBFHeader, recordIndex: number): Record<string, any> | null {
  if (!header || recordIndex < 0 || recordIndex >= header.recordCount) {
    return null;
  }
  
  // Calcula a posição do registro no buffer
  const recordOffset = header.headerSize + (recordIndex * header.recordSize);
  
  // Verifica se o registro está excluído (marcado com *)
  const recordDeleted = buffer[recordOffset] === 0x2A; // '*' character
  
  if (recordDeleted) {
    console.log(`Registro ${recordIndex} está marcado como excluído`);
    return null;
  }
  
  const record: Record<string, any> = {};
  
  // Processa cada campo
  for (const field of header.fields) {
    // Posição do campo no registro
    const fieldOffset = recordOffset + 1 + field.offset; // +1 para pular o marcador de exclusão
    
    // Extrai os bytes do campo
    const fieldData = buffer.slice(fieldOffset, fieldOffset + field.length);
    
    // Converte o valor conforme o tipo do campo
    let value: any;
    
    switch (field.type) {
      case 'C': // Character
        value = fieldData.toString('utf8').trim();
        break;
      
      case 'N': // Numeric
        const numStr = fieldData.toString('utf8').trim();
        value = numStr === '' ? null : (field.decimalPlaces > 0 ? parseFloat(numStr) : parseInt(numStr, 10));
        break;
      
      case 'F': // Float
        const floatStr = fieldData.toString('utf8').trim();
        value = floatStr === '' ? null : parseFloat(floatStr);
        break;
      
      case 'L': // Logical
        const logicalChar = fieldData.toString('utf8').trim().toUpperCase();
        value = ['T', 'Y'].includes(logicalChar) ? true : 
               ['F', 'N'].includes(logicalChar) ? false : null;
        break;
      
      case 'D': // Date (formato YYYYMMDD)
        const dateStr = fieldData.toString('utf8').trim();
        if (dateStr.length === 8) {
          const year = parseInt(dateStr.substring(0, 4), 10);
          const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Mês em JS é 0-11
          const day = parseInt(dateStr.substring(6, 8), 10);
          value = new Date(year, month, day);
        } else {
          value = null;
        }
        break;
      
      case 'M': // Memo
        // Memos requerem processamento adicional com referência a arquivos externos
        // Aqui apenas retornamos o valor do ponteiro
        value = fieldData.toString('utf8').trim();
        break;
      
      default:
        value = fieldData.toString('utf8').trim();
    }
    
    // Adiciona o valor ao registro
    record[field.name] = value;
  }
  
  return record;
}

/**
 * Função para ler todos os registros de um arquivo DBF
 * @param buffer Buffer contendo os dados do arquivo DBF
 * @returns Array com todos os registros ou null em caso de erro
 */
export function LER_TODOS_REGISTROS_DBF(buffer: Buffer): Record<string, any>[] | null {
  try {
    // Processa o cabeçalho
    const header = CHECA_HEADER_DBF(buffer);
    
    if (!header) {
      console.error("Erro ao processar cabeçalho DBF");
      return null;
    }
    
    const records: Record<string, any>[] = [];
    
    // Lê todos os registros
    for (let i = 0; i < header.recordCount; i++) {
      const record = LER_REGISTRO_DBF(buffer, header, i);
      if (record) {
        records.push(record);
      }
    }
    
    return records;
  } catch (error) {
    console.error("Erro ao ler registros DBF:", error);
    return null;
  }
}

// Função de utilidade para formatar detalhes do cabeçalho DBF para exibição
export function FORMATAR_INFO_DBF(header: DBFHeader): string {
  if (!header) return "Cabeçalho DBF inválido";
  
  let info = "Informações do arquivo DBF:\n";
  info += `Versão: ${header.version}\n`;
  info += `Última atualização: ${header.lastUpdate.toLocaleDateString()}\n`;
  info += `Número de registros: ${header.recordCount}\n`;
  info += `Tamanho do cabeçalho: ${header.headerSize} bytes\n`;
  info += `Tamanho de cada registro: ${header.recordSize} bytes\n`;
  
  if (header.hasCodePage && header.codePage) {
    info += `Code Page: ${header.codePage}\n`;
  }
  
  info += "\nCampos:\n";
  for (const field of header.fields) {
    info += `  ${field.name} (${field.type}): `;
    info += `Tamanho=${field.length}`;
    if (field.decimalPlaces > 0) {
      info += `, Decimais=${field.decimalPlaces}`;
    }
    info += `, Offset=${field.offset}\n`;
  }
  
  return info;
}

// Exemplo de uso:
/*
// Ler arquivo DBF
const fs = require('fs');
const buffer = fs.readFileSync('arquivo.dbf');

// Verificar cabeçalho
const header = CHECA_HEADER_DBF(buffer);
if (header) {
  console.log(FORMATAR_INFO_DBF(header));
  
  // Ler registros
  const registros = LER_TODOS_REGISTROS_DBF(buffer);
  console.log(`Total de registros lidos: ${registros?.length || 0}`);
}
*/