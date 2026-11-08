// Dados fictícios usados pelos testes (nenhum dado real de sócios).
const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

function proximoSabado() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().split("T")[0];
}

export const MES_ATUAL = mesAtual;
export const PROXIMO_SABADO = proximoSabado();

export const SOCIO_TESTE = {
  id: 1,
  nome: "Atleta Teste Silva",
  email: "atleta@teste.pt",
  telemovel: "912345678",
  password: "segredo123",
  modalidade: "Kickboxing",
  treinador: "Bogas",
  estado: "Ativo",
  data_inscricao: "2024-01-10",
  graduacao: "Amarela",
  federacao: "Regularizada",
  data_ultima_graduacao: "2025-06-01",
  data_inativo: null,
  data_reentrada: null,
  regulamento_aceite: true,
  foto_url: null,
};

export function tabelasBase() {
  return {
    socios: [
      SOCIO_TESTE,
      { ...SOCIO_TESTE, id: 2, nome: "Outro <b>Atleta</b>", email: "outro@teste.pt", password: null, telemovel: "934567890", regulamento_aceite: false },
      { ...SOCIO_TESTE, id: 3, nome: "Inativo Exemplo", email: "inativo@teste.pt", estado: "Inativo" },
    ],
    mensalidades: [
      { id: 100, socio_id: 1, mes_ano: mesAtual, valor: 35, estado: "Pago", tipo: "Mensalidade", dia_aula: null, hora_aula: null, aula_id: null },
      { id: 101, socio_id: 2, mes_ano: mesAtual, valor: 35, estado: "Pendente", tipo: "Mensalidade", dia_aula: null, hora_aula: null, aula_id: null },
    ],
    aulas_particulares: [
      { id: 200, socio_id: 1, data_aula: PROXIMO_SABADO, hora_aula: "14:00:00", estado: "Pendente", valor: null, pago: false },
      { id: 201, socio_id: 2, data_aula: `${mesAtual}-01`, hora_aula: "15:00:00", estado: "Aceite", valor: 25, pago: false },
    ],
    notificacoes: [
      { id: 300, socio_id: 1, titulo: "Bem-vindo", mensagem: "Olá <script>x</script>", lida: false, created_at: new Date().toISOString() },
    ],
    despesas: [
      { id: 400, descricao: "Luvas", categoria: "Material", data: `${mesAtual}-02`, valor: 50, treinador: "Bogas" },
    ],
    push_subscriptions: [],
    admin_push_subscriptions: [],
    sistema_ping: [{ id: 1 }],
    treinadores: [{ user_id: "00000000-0000-4000-8000-000000000001", nome: "Bogas" }],
    produtos: [
      { id: 500, nome: "Ligaduras", categoria: "Ligaduras", preco_compra: 3, preco_venda: 8, stock_minimo: 2, ativo: true },
    ],
    produto_variantes: [{ id: 510, produto_id: 500, nome: "Único", stock: 5 }],
    vendas: [],
    venda_itens: [],
    stock_movimentos: [],
    socio_congelamentos: [],
  };
}
