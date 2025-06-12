import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import HarbourSystemIntegration from './HarbourIntegration';
import CompanyDetector from './CompanyDetector';

/*
interface CommandResult {
    output: string;
    exitCode: number | null;
    error: string | null;
}

async function callHarbourExeSpawnWithParams(harbourExePath: string, dbfPath: string): Promise<CommandResult> {

    // Passe os parâmetros como um array de strings.
    // O Node.js se encarrega de formatá-los corretamente para o processo filho.
    const args = [harbourExePath, String(dbfPath)];

    console.log(`Executando comando: "${harbourExePath}" com argumentos: ${JSON.stringify(args)}`); // Para depuração

    let stdoutData = '';
    let stderrData = '';
    let exitCode: number | null = null;

    return new Promise((resolve, reject) => {
        const child = cp.spawn(harbourExePath, args, {
            detached: true, // Não precisa ser true, a menos que você queira que o processo continue rodando após o script terminar
            windowsHide: true, // Esconde a janela do console no Windows
        }); // Passe o array de argumentos aqui

        child.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        child.on('close', (code) => {
            exitCode = code;
            resolve({ output: stdoutData.trim(), exitCode: exitCode, error: stderrData.trim() || null });
        });

        child.on('error', (err) => {
            console.error(`Falha ao iniciar o processo Harbour: ${err.message}`);
            // Em caso de erro de spawn (ex: arquivo não encontrado), reject.
            reject({ output: stdoutData.trim(), exitCode: null, error: err.message});
        });
    });
}

// Exemplo de uso:
async function mainSpawn(dbfFileName: string) {
    console.log('Chamando programa Harbour com spawn e parâmetros...');
    const harbourExePath = path.join("C:\\Users\\franklin.paixao\\OneDrive\\desencriptado\\encrypta\\decrypt_crypt_dbf.exe");

    const system = new HarbourSystemIntegration();
    await system.initialize();
    const company = system.getCurrentCompanyInfo();
    console.log(`Empresa ativa: ${company?.code}`);
    const parametro = path.join(`${company?.code}`);
    try {
        /*
        const result1 = await callHarbourExeSpawnWithParams(harbourExePath, parametro);
        if (result1.exitCode === 0) {
            console.log(`[Chamada 1 - Spawn] Programa Harbour executado com sucesso!`);
            console.log(`[Chamada 1 - Spawn] Valor retornado (stdout):\n"${result1.output}"`);
        } else {
            console.error(`[Chamada 1 - Spawn] Programa Harbour falhou com código de saída ${result1.exitCode}.`);
            console.error(`[Chamada 1 - Spawn] Erro: ${result1.error}`);
            console.error(`[Chamada 1 - Spawn] Saída:\n"${result1.output}"`);
        }

    } catch (error) {
        // Captura erros de spawn que impedem o início do processo
        console.error(`Erro fatal ao chamar EXE via spawn: ${error}`);
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
    const tabelasComuns = ['XXPREG', 'EMMDOR', 'XXPESS'];

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

/*

async function localizarEmpresaViaCMD() {

  cp.exec('handle64a.exe -p cmd.exe', (err, stdout, stderr) => {

    if (err) {
      console.error("Erro ao executar handle.exe. Verifique permissões administrativas.");
      return;
    }

    const linhas = stdout.split('\n');
    const linhaComCaminho = linhas.find(linha =>
      linha.includes('Q:\\ASPEC\\VERATUAL\\')  // ou só 'VERATUAL'
    );

    if (!linhaComCaminho) {
      console.log("Não foi possível localizar o caminho da empresa.");
      return;
    }

    const match = linhaComCaminho.match(/Q:\\ASPEC\\VERATUAL\\([^\\\s]+)/i);
    if (match && match[1]) {
      const codigoEmpresa = match[1];
      console.log("Código da empresa:", codigoEmpresa);
    } else {
      console.log("Caminho localizado, mas não foi possível extrair o código.");
    }
  });
}

localizarEmpresaViaCMD();

// Exemplo de uso
async function localizaEmpresa() {
  const detector = new CompanyDetector();

  try {
    const activeCompany = await detector.detectActiveCompany();

    if (activeCompany) {
      console.log('\n📊 Empresa Ativa Detectada:');
      console.log(`Código: ${activeCompany.code}`);
      console.log(`Caminho: ${activeCompany.fullPath}`);

      if (activeCompany.processId) {
        console.log(`Process ID: ${activeCompany.processId}`);
      }

      if (activeCompany.windowTitle) {
        console.log(`Título da Janela: ${activeCompany.windowTitle}`);
      }

      // Valida se a empresa existe e tem arquivos DBF
      const isValid = await detector.validateCompany(activeCompany.code);
      console.log(`Válida: ${isValid ? '✅' : '❌'}`);

      if (isValid) {
        console.log(`\n🎯 Você pode acessar as tabelas DBF em: ${activeCompany.fullPath}`);
      }

    } else {
      console.log('❌ Nenhuma empresa ativa foi detectada');
    }

  } catch (error) {
    console.error('Erro:', error);
  }
}

// Executar se for chamado diretamente

  localizaEmpresa(); */


