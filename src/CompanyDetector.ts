import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface CompanyInfo {
  code: string;
  fullPath: string;
  processId?: number;
  windowTitle?: string;
}

class CompanyDetector {
  private baseWorkspacePath: string;

  constructor() {
    const username = os.userInfo().username;
    this.baseWorkspacePath = `C:\\Desenv\\WorkSpace\\${username}\\Q_Dados\\ultima\\ASPEC\\VERATUAL`;
  }

  /**
   * Método 1: Detecta empresa pelo processo ativo com maior atividade
   */
  async detectActiveCompanyByProcess(): Promise<CompanyInfo | null> {
    try {
      // Lista todos os processos CMD/DOS com seus diretórios de trabalho
      const { stdout } = await execAsync(`wmic process where "name='cmd.exe'" get ProcessId,CommandLine /format:csv`);

      const lines = stdout.split('\n').filter(line => line.trim());
      const companies: CompanyInfo[] = [];

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const commandLine = parts[1];
          const processId = parseInt(parts[2]);

          // Extrai o diretório de trabalho do processo
          const workingDir = await this.getProcessWorkingDirectory(processId);

          const companyCode = this.extractCompanyCode(workingDir);

          if (companyCode) {
            companies.push({
              code: companyCode,
              fullPath: path.join(this.baseWorkspacePath, companyCode),
              processId: processId,
            });
          }
        }
      }

      // Retorna a empresa com processo mais recentemente ativo
      return this.getMostActiveCompany(companies);

    } catch (error) {
      console.error('Erro ao detectar empresa por processo:', error);
      return null;
    }
  }

  /**
   * Método 2: Detecta empresa pelo arquivo mais recentemente acessado
   */
  async detectActiveCompanyByFileAccess(): Promise<CompanyInfo | null> {
    try {
      const companies = await this.getAllCompanyDirectories();
      let mostRecentCompany: CompanyInfo | null = null;
      let mostRecentTime = 0;

      for (const company of companies) {
        const dbfFiles = await this.getDBFFiles(company.fullPath);
        console.log(`🔍 Verificando arquivos DBF em: ${dbfFiles}`);
        for (const dbfFile of dbfFiles) {
          const stats = fs.statSync(dbfFile);
          const accessTime = Math.max(stats.atimeMs, stats.mtimeMs);

          if (accessTime > mostRecentTime) {
            mostRecentTime = accessTime;
            mostRecentCompany = company;
          }
        }
      }

      return mostRecentCompany;

    } catch (error) {
      console.error('Erro ao detectar empresa por acesso a arquivo:', error);
      return null;
    }
  }

  /**
   * Método 3: Detecta empresa por janela de comando ativa
   */
  async detectActiveCompanyByWindow(): Promise<CompanyInfo | null> {
    try {
      // Usa PowerShell para obter informações das janelas ativas
      const psScript = `
        Get-Process | Where-Object {$_.MainWindowTitle -ne ""} |
        Where-Object {$_.ProcessName -eq "cmd"} |
        Select-Object Id, MainWindowTitle, Path |
        ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
      const windows = JSON.parse(stdout || '[]');

      for (const window of Array.isArray(windows) ? windows : [windows]) {
        if (window && window.MainWindowTitle) {
          const companyCode = this.extractCompanyCodeFromTitle(window.MainWindowTitle);
          if (companyCode) {
            return {
              code: companyCode,
              fullPath: path.join(this.baseWorkspacePath, companyCode),
              processId: window.Id,
              windowTitle: window.MainWindowTitle
            };
          }
        }
      }

      return null;

    } catch (error) {
      console.error('Erro ao detectar empresa por janela:', error);
      return null;
    }
  }

  /**
   * Método principal que combina todas as estratégias
   */
  async detectActiveCompany(): Promise<CompanyInfo | null> {
    console.log('🔍 Detectando empresa ativa...');

    // Tenta método por janela ativa primeiro (mais confiável)
    let result = await this.detectActiveCompanyByWindow();
    if (result) {
      console.log(`✅ Empresa detectada por janela ativa: ${result.code}`);
      return result;
    }

    // Tenta por processo ativo
    result = await this.detectActiveCompanyByProcess();
    if (result) {
      console.log(`✅ Empresa detectada por processo: ${result.code}`);
      return result;
    }

    // Por último, tenta por arquivo mais recente
    result = await this.detectActiveCompanyByFileAccess();
    if (result) {
      console.log(`✅ Empresa detectada por acesso a arquivo: ${result.code}`);
      return result;
    }

    console.log('❌ Nenhuma empresa ativa detectada');
    return null;
  }

  /**
   * Utilitários privados
   */
  private async getProcessWorkingDirectory(processId: number): Promise<string> {
    try {
      const { stdout } = await execAsync(`powershell -Command "Get-Process -Id ${processId} | Select-Object -ExpandProperty Path"`);
      return stdout.trim();
    } catch {
      return '';
    }
  }

  private extractCompanyCode(path: string): string | null {
    const regex = /VERATUAL[\\\/]([A-Z]{2}[A-Z0-9]{3})[\\\/]?/i;
    const match = path.match(regex);
    return match ? match[1].toUpperCase() : null;
  }

  private extractCompanyCodeFromTitle(title: string): string | null {
    // Busca padrões como "C:\...\VERATUAL\CE63C" no título da janela
    const regex = /VERATUAL[\\\/]([A-Z]{2}[A-Z0-9]{3})/i;
    const match = title.match(regex);
    return match ? match[1].toUpperCase() : null;
  }

  private async getAllCompanyDirectories(): Promise<CompanyInfo[]> {
    const companies: CompanyInfo[] = [];

    try {
      if (!fs.existsSync(this.baseWorkspacePath)) {
        return companies;
      }

      const entries = fs.readdirSync(this.baseWorkspacePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const code = entry.name;
          // Verifica se segue o padrão: 2 letras + 3 caracteres alfanuméricos
          if (/^[A-Z]{2}[A-Z0-9]{3}$/i.test(code)) {
            companies.push({
              code: code.toUpperCase(),
              fullPath: path.join(this.baseWorkspacePath, code)
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao listar diretórios de empresas:', error);
    }

    return companies;
  }

  private async getDBFFiles(companyPath: string): Promise<string[]> {
    const dbfFiles: string[] = [];

    try {
      if (!fs.existsSync(companyPath)) {
        return dbfFiles;
      }

      const files = fs.readdirSync(companyPath);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.dbf')) {
          dbfFiles.push(path.join(companyPath, file));
        }
      }
    } catch (error) {
      console.error(`Erro ao listar arquivos DBF em ${companyPath}:`, error);
    }

    return dbfFiles;
  }

  private async getMostActiveCompany(companies: CompanyInfo[]): Promise<CompanyInfo | null> {
    if (companies.length === 0) return null;
    if (companies.length === 1) return companies[0];

    // Por enquanto retorna o primeiro, mas aqui você pode implementar
    // lógica para determinar qual processo está mais ativo
    return companies[0];
  }

  /**
   * Método utilitário para validar se uma empresa existe
   */
  async validateCompany(companyCode: string): Promise<boolean> {
    const companyPath = path.join(this.baseWorkspacePath, companyCode);

    try {
      if (!fs.existsSync(companyPath)) {
        return false;
      }

      // Verifica se existe pelo menos um arquivo .DBF
      const dbfFiles = await this.getDBFFiles(companyPath);
      return dbfFiles.length > 0;

    } catch {
      return false;
    }
  }
}

// Exportações nomeadas
export { CompanyDetector, CompanyInfo };

// Exportação padrão
export default CompanyDetector;