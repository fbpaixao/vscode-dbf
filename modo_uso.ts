const system = new HarbourSystemIntegration();
await system.initialize();

const company = system.getCurrentCompanyInfo();
console.log(`Empresa ativa: ${company?.code}`);

const tablePath = system.getTablePath('CLIENTES');
// Agora você pode acessar: C:\Desenv\WorkSpace\Usuario\Q_Dados\ultima\ASPEC\VERATUAL\CE63C\CLIENTES.DBF