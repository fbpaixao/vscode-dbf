import { CompanyDetector, CompanyInfo } from './company-detector';
import * as fs from 'fs';
import * as path from 'path';

class HarbourSystemIntegration {
  private detector: CompanyDetector;
  private currentCompany: CompanyInfo | null = null;
  
  constructor() {
    this.detector = new CompanyDetector();
  }

  /**
   * Inicializa o sistema detectando automaticamente a empresa ativa
   */
  async initialize(): Promise<boolean> {
    console.log('🚀 Inicializando integração com sistema Harbour...');
    
    this.currentCompany = await this.detector.detectActiveCompany();
    
    if (!this.currentCompany) {
      console.error('❌ Não foi possível detectar uma empresa ativa');
      return false;
    }
    
    const isValid = await this.detector.validateCompany(this.currentCompany.code);
    if (!isValid) {
      console.error(`❌ Empresa ${this.currentCompany.code} não possui arquivos DBF válidos`);
      return false;
    }
    
    console.log(`✅ Sistema inicializado para empresa: ${this.currentCompany.code}`);
    console.log(`📁 Diretório: ${this.currentCompany.fullPath}`);
    
    return true;
  }

  /**
   * Obtém o caminho completo para uma tabela específica
   */
  getTablePath(tableName: string): string {
    if (!this.currentCompany) {
      throw new Error('Sistema não inicializado. Chame initialize() primeiro.');
    }
    
    // Remove extensão se fornecida e adiciona .DBF
    const cleanTableName = tableName.replace(/\.(dbf|DBF)$/, '');
    return path.join(this.currentCompany.fullPath, `${cleanTableName}.DBF`);
  }

  /**
   * Verifica se uma tabela existe
   */
  tableExists(tableName: string): boolean {
    try {
      const tablePath = this.getTablePath(tableName);
      return fs.existsSync(tablePath);
    } catch {
      return false;
    }
  }

  /**
   * Lista todas as tabelas disponíveis
   */
  async listAvailableTables(): Promise<string[]> {
    if (!this.currentCompany) {
      throw new Error('Sistema não inicializado. Chame initialize() primeiro.');
    }
    
    const tables: string[] = [];
    
    try {
      const files = fs.readdirSync(this.currentCompany.fullPath);
      
      for (const file of files) {
        if (file.toLowerCase().endsWith('.dbf')) {
          tables.push(file.replace(/\.dbf$/i, ''));
        }
      }
    } catch (error) {
      console.error('Erro ao listar tabelas:', error);
    }
    
    return tables.sort();
  }

  /**
   * Obtém informações da empresa atual
   */
  getCurrentCompanyInfo(): CompanyInfo | null {
    return this.currentCompany;
  }

  /**
   * Força a re-detecção da empresa ativa
   */
  async refreshActiveCompany(): Promise<boolean> {
    console.log('🔄 Atualizando detecção de empresa ativa...');
    return await this.initialize();
  }

  /**
   * Exemplo de leitura de uma tabela DBF (usando node-dbf ou similar)
   */
  async readTable(tableName: string): Promise<any[]> {
    if (!this.tableExists(tableName)) {
      throw new Error(`Tabela ${tableName} não encontrada na empresa ${this.currentCompany?.code}`);
    }
    
    const tablePath = this.getTablePath(tableName);
    console.log(`📖 Lendo tabela: ${tablePath}`);
    
    // Aqui você integraria com sua biblioteca de leitura DBF preferida
    // Exemplo com node-dbf:
    // const dbf = require('node-dbf');
    // return new Promise((resolve, reject) => {
    //   dbf.parse(tablePath, (err, data) => {
    //     if (err) reject(err);
    //     else resolve(data);
    //   });
    // });
    
    // Por enquanto, apenas um placeholder
    console.log(`✅ Tabela ${tableName} carregada com sucesso`);
    return [];
  }

  /**
   * Monitora mudanças na empresa ativa (polling simples)
   */
  startCompanyMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    console.log(`👁️ Iniciando monitoramento de empresa ativa (${intervalMs}ms)`);
    
    return setInterval(async () => {
      const newCompany = await this.detector.detectActiveCompany();
      
      if (newCompany && newCompany.code !== this.currentCompany?.code) {
        console.log(`🔄 Mudança de empresa detectada: ${this.currentCompany?.code} → ${newCompany.code}`);
        this.currentCompany = newCompany;
        
        // Aqui você pode disparar eventos ou callbacks para notificar a mudança
        this.onCompanyChanged(newCompany);
      }
    }, intervalMs);
  }

  /**
   * Callback chamado quando a empresa ativa muda
   */
  private onCompanyChanged(newCompany: CompanyInfo): void {
    console.log(`📢 Nova empresa ativa: ${newCompany.code}`);
    console.log(`📁 Novo diretório: ${newCompany.fullPath}`);
    
    // Aqui você pode implementar lógica adicional como:
    // - Recarregar configurações específicas da empresa
    // - Limpar caches de dados da empresa anterior
    // - Notificar outros módulos da aplicação
  }
}

// Exemplo de uso prático
async function exemploDeUso() {
  const system = new HarbourSystemIntegration();
  
  try {
    // Inicializa o sistema
    const initialized = await system.initialize();
    if (!initialized) {
      console.error('Falha na inicialização do sistema');
      return;
    }
    
    // Obtém informações da empresa atual
    const companyInfo = system.getCurrentCompanyInfo();
    console.log(`\n📊 Trabalhando com empresa: ${companyInfo?.code}`);
    
    // Lista tabelas disponíveis
    const tables = await system.listAvailableTables();
    console.log(`\n📋 Tabelas disponíveis (${tables.length}):`);
    tables.forEach(table => console.log(`  - ${table}`));
    
    // Exemplo de verificação de tabela específica
    const tabelasComuns = ['CLIENTES', 'PRODUTOS', 'VENDAS', 'ESTOQUE'];
    
    console.log('\n🔍 Verificando tabelas comuns:');
    for (const tabela of tabelasComuns) {
      const existe = system.tableExists(tabela);
      console.log(`  ${tabela}: ${existe ? '✅' : '❌'}`);
      
      if (existe) {
        const caminho = system.getTablePath(tabela);
        console.log(`    Caminho: ${caminho}`);
      }
    }
    
    // Inicia monitoramento de mudanças (opcional)
    const monitor = system.startCompanyMonitoring(15000); // Verifica a cada 15 segundos
    
    // Para parar o monitoramento depois de um tempo (exemplo)
    setTimeout(() => {
      clearInterval(monitor);
      console.log('⏹️ Monitoramento interrompido');
    }, 60000); // Para após 1 minuto
    
  } catch (error) {
    console.error('❌ Erro na execução:', error);
  }
}

// Executar exemplo se chamado diretamente
if (require.main === module) {
  exemploDeUso();
}

export { HarbourSystemIntegration };