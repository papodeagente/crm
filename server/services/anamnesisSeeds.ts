/**
 * Anamnese — definições padrão dos 3 templates clínicos (Clairis):
 *  - Protocolo HOF (49 itens)
 *  - Anamnese Estética (122 itens)
 *  - Anamnese CO2 Fracionado (25 itens)
 *
 * Convenções:
 *  - questionType "select" + options ["Sim","Não","Não sei"] (ou ["Sim","Não"]) é o radio das fichas.
 *  - hasExtraField=true expõe um input texto complementar ao radio. extraFieldLabel guia o placeholder.
 *  - questionType "textarea" para campos dissertativos.
 *  - section organiza visualmente o formulário.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

type QuestionType = "text" | "textarea" | "boolean" | "select" | "multiselect" | "number" | "date";

interface SeedQuestion {
  question: string;
  type: QuestionType;
  options?: string[];
  hasExtra?: boolean;
  extraLabel?: string;
  section?: string;
}

interface SeedTemplate {
  slug: string;
  name: string;
  description: string;
  isDefault?: boolean;
  questions: SeedQuestion[];
}

const SIM_NAO_NAOSEI = ["Sim", "Não", "Não sei"];
const SIM_NAO = ["Sim", "Não"];

const radio = (q: string, options: string[] = SIM_NAO_NAOSEI, section?: string): SeedQuestion => ({
  question: q, type: "select", options, section,
});

const radioExtra = (q: string, extraLabel = "Quais?", options: string[] = SIM_NAO_NAOSEI, section?: string): SeedQuestion => ({
  question: q, type: "select", options, hasExtra: true, extraLabel, section,
});

const textArea = (q: string, section?: string): SeedQuestion => ({ question: q, type: "textarea", section });

// ─────────────────────────────────────────────────────────────
// 1) PROTOCOLO HOF
// ─────────────────────────────────────────────────────────────
const HOF: SeedTemplate = {
  slug: "hof",
  name: "Protocolo HOF",
  description: "Avaliação pré-procedimento de harmonização orofacial (48 perguntas).",
  isDefault: true,
  questions: [
    // Histórico clínico (radio + Quais?)
    radioExtra("Faz algum uso de medicamento momentâneo e/ou contínuo?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Possui algum tipo de alergia a algum medicamento, anestesia e/ou insetos?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Usa ou já usou algum tipo de ácido na pele?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Faz algum tipo de cuidado diário na pele?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Está sob algum tipo de tratamento médico?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Tem alguma formação sólida na pele (ex: nódulos, pápula, sequela etc)?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Faz uso de reposição hormonal?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Tem alguma doença infectocontagiosa (ex: hepatite B e C, HIV, sífilis etc)?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Tem alguma alteração vascular (ex: petéquias, cianose, eritema etc)?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Possui alguma doença cardiovascular?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Tem ou já teve algum distúrbio respiratório?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Já sofreu algum trauma na face?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Já sofreu algum desmaio ou convulsão?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Tem alguma doença nos órgãos (ex: coração, rim, fígado etc)?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radioExtra("Possui diabetes e/ou outra doença autoimune?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),

    // Hábitos & estilo de vida (radio simples Sim/Não)
    radio("Possui predisposição para queloides?", SIM_NAO, "Hábitos e estilo de vida"),
    radio("Tem hematomas com facilidade?", SIM_NAO, "Hábitos e estilo de vida"),
    radioExtra("Possui alguma prótese facial ou corporal?", "Quais?", SIM_NAO_NAOSEI, "Hábitos e estilo de vida"),
    radioExtra("Faz uso de bebidas alcoólicas e/ou é fumante?", "Quais?", SIM_NAO_NAOSEI, "Hábitos e estilo de vida"),
    radioExtra("Possui alguma doença que interfira na coagulação do sangue?", "Quais?", SIM_NAO_NAOSEI, "Hábitos e estilo de vida"),
    radio("Tem previsão de viagem a passeio nos próximos 60 dias?", SIM_NAO, "Hábitos e estilo de vida"),
    radioExtra("Possui transtorno de imagem, dismorfia corporal ou quadro depressivo?", "Quais?", SIM_NAO_NAOSEI, "Hábitos e estilo de vida"),
    radio("Tem muita exposição ao sol?", SIM_NAO, "Hábitos e estilo de vida"),
    radio("Já teve problemas de ansiedade ou se sentiu excessivamente preocupado(a) com algum aspecto da sua aparência?", SIM_NAO, "Hábitos e estilo de vida"),
    radioExtra("Pratica exercícios físicos?", "Quais?", SIM_NAO_NAOSEI, "Hábitos e estilo de vida"),

    // Dissertativas — expectativas
    textArea("Qual a sua expectativa relacionada ao resultado final?", "Expectativas e percepção"),
    radioExtra("Você já teve algum problema (dano ou insatisfação de resultado) em tratamentos anteriores?", "Quais?", SIM_NAO_NAOSEI, "Expectativas e percepção"),
    radioExtra("Possui alguma doença neurológica (esclerose, síndrome de Guillain-Barré, miastenia)?", "Quais?", SIM_NAO_NAOSEI, "Histórico clínico"),
    textArea("Durante o tratamento, qual é a sua preferência em relação às explicações do profissional?", "Expectativas e percepção"),
    textArea("Quando está em atendimento, você prefere conversar bastante, conversar pouco ou apenas observar?", "Expectativas e percepção"),

    // Histórico estético
    radioExtra("Já fez algum tipo de tratamento estético ou cirúrgico?", "Quais?", SIM_NAO_NAOSEI, "Histórico estético"),
    radio("Já fez algum procedimento estético com PMMA?", SIM_NAO, "Histórico estético"),
    radio("Possui alguma patologia dermatológica?", SIM_NAO, "Histórico estético"),
    radioExtra("Possui manchas na pele (ex: hipocromia, cloasma, melasma etc)?", "Quais?", SIM_NAO_NAOSEI, "Histórico estético"),
    radioExtra("Possui varizes e/ou varicoses?", "Quais?", SIM_NAO_NAOSEI, "Histórico estético"),
    radio("Faz uso de Roacutan?", SIM_NAO, "Histórico estético"),
    radio("Possui hereditariedade de acne?", SIM_NAO, "Histórico estético"),
    radio("Possui cachorro(s) ou gato(s) na residência?", SIM_NAO, "Hábitos e estilo de vida"),
    radioExtra("Já fez algum procedimento de harmonização facial ou botox?", "Quais?", SIM_NAO_NAOSEI, "Histórico estético"),
    radio("Possui alguma doença muscular?", SIM_NAO, "Histórico clínico"),
    radio("Sangra muito quando é ferido ou já teve algum episódio de hemorragia?", SIM_NAO, "Histórico clínico"),
    radio("Teve diagnóstico da Covid-19 e/ou tomou alguma dose da vacina?", SIM_NAO, "Histórico clínico"),

    // Autoestima e expectativas
    radio("Você se sente pressionado(a) por outras pessoas ou pela mídia em relação à sua aparência?", SIM_NAO, "Expectativas e percepção"),
    textArea("Como você descreveria o seu nível de autoestima em relação à sua aparência?", "Expectativas e percepção"),
    radio("Tem alguma contraindicação à ingestão de corticoide?", SIM_NAO, "Histórico clínico"),
    textArea("Já recebeu comentários negativos sobre sua aparência? Como isso afetou você?", "Expectativas e percepção"),
    textArea("Em uma escala de 0 a 10, qual é o nível de importância que você atribui ao procedimento estético em sua vida?", "Expectativas e percepção"),
    textArea("Como você reagiria caso os resultados do procedimento não atendessem completamente suas expectativas?", "Expectativas e percepção"),
  ],
};

// ─────────────────────────────────────────────────────────────
// 2) ANAMNESE ESTÉTICA — todas as 121 perguntas seguem o padrão
//    radio [Sim, Não, Não sei] + extra "Informações adicionais"
// ─────────────────────────────────────────────────────────────
const ESTETICA_QUESTIONS_RAW: { q: string; section: string }[] = [
  // Histórico estético
  { q: "Já realizou procedimentos estéticos?", section: "Histórico estético" },
  { q: "Quais?", section: "Histórico estético" },
  { q: "Houve melhora?", section: "Histórico estético" },
  { q: "Já fez aplicação de toxina botulínica?", section: "Histórico estético" },
  { q: "Já fez algum preenchimento dérmico?", section: "Histórico estético" },
  { q: "Usa ou já usou ácidos na pele?", section: "Histórico estético" },
  { q: "Onde e quando?", section: "Histórico estético" },
  // Cuidados com a pele
  { q: "Faz o uso de protetor solar?", section: "Cuidados com a pele" },
  { q: "FPS?", section: "Cuidados com a pele" },
  { q: "Usa algum cosmético?", section: "Cuidados com a pele" },
  { q: "Reaplica?", section: "Cuidados com a pele" },
  { q: "Quantas vezes?", section: "Cuidados com a pele" },
  { q: "Rotina de cuidados?", section: "Cuidados com a pele" },
  // Pele
  { q: "Quando toma sol como sua pele se comporta?", section: "Pele" },
  { q: "Possui manchas de sol?", section: "Pele" },
  { q: "Como é sua pele?", section: "Pele" },
  { q: "Como sente sua pele?", section: "Pele" },
  { q: "Possui efélides (sardas)?", section: "Pele" },
  { q: "Possui telangectasias?", section: "Pele" },
  { q: "Região:", section: "Pele" },
  { q: "Possui melasma?", section: "Pele" },
  { q: "Quando se machuca tende a ficar manchado(a) no local da casquinha, por exemplo?", section: "Pele" },
  { q: "Tem ou já apresentou, em alguma fase da vida, acne?", section: "Pele" },
  { q: "Faz algum tipo de depilação?", section: "Hábitos" },
  { q: "Pratica atividade física?", section: "Hábitos" },
  { q: "Tem rosácea?", section: "Pele" },
  { q: "Tem foliculite (pelo encravado)?", section: "Pele" },
  { q: "Possui dermatite?", section: "Pele" },
  { q: "Qual?", section: "Pele" },
  { q: "Possui alguma lesão suspeita?", section: "Pele" },
  { q: "Onde?", section: "Pele" },
  { q: "Frequência:", section: "Pele" },
  // Alimentação e hidratação
  { q: "Como funciona o seu intestino?", section: "Alimentação e hidratação" },
  { q: "Qual a quantidade de água ingerida por dia:", section: "Alimentação e hidratação" },
  { q: "Descreva um dia de sua alimentação:", section: "Alimentação e hidratação" },
  { q: "Faz acompanhamento alimentar?", section: "Alimentação e hidratação" },
  { q: "Com qual profissional faz acompanhamento?", section: "Alimentação e hidratação" },
  { q: "Intolerância alimentar?", section: "Alimentação e hidratação" },
  { q: "A que?", section: "Alimentação e hidratação" },
  { q: "E alergia alimentar?", section: "Alimentação e hidratação" },
  { q: "A que é alérgico?", section: "Alimentação e hidratação" },
  { q: "Retém líquido com frequência?", section: "Alimentação e hidratação" },
  { q: "Ganha peso ou perde peso com facilidade?", section: "Alimentação e hidratação" },
  // Hábitos
  { q: "Ingere bebida alcoólica?", section: "Hábitos" },
  { q: "Fuma?", section: "Hábitos" },
  { q: "Toma café?", section: "Hábitos" },
  { q: "Quantidade dia?", section: "Hábitos" },
  { q: "Quantos cigarros por dia?", section: "Hábitos" },
  { q: "Como é seu sono?", section: "Hábitos" },
  { q: "Quantas horas/noite:", section: "Hábitos" },
  { q: "Acorda com frequência durante a noite?", section: "Hábitos" },
  { q: "Quando acorda sente-se descansado(a)?", section: "Hábitos" },
  // Histórico clínico
  { q: "Já fez alguma cirurgia?", section: "Histórico clínico" },
  { q: "Como foi sua recuperação?", section: "Histórico clínico" },
  { q: "Possui alguma prótese?", section: "Histórico clínico" },
  { q: "Qual parte do corpo?", section: "Histórico clínico" },
  { q: "Há quanto tempo?", section: "Histórico clínico" },
  { q: "Faz o uso de algum hormônio?", section: "Histórico clínico" },
  { q: "Faz o uso de algum suplemento?", section: "Histórico clínico" },
  { q: "Faz algum acompanhamento médico?", section: "Histórico clínico" },
  { q: "Faz exame periodicamente?", section: "Histórico clínico" },
  { q: "Tem alergia a algum produto ou medicamento?", section: "Histórico clínico" },
  { q: "Faz ou fez (último mês) uso de algum medicamento?", section: "Histórico clínico" },
  { q: "Qual(is)?", section: "Histórico clínico" },
  { q: "Com qual profissional?", section: "Histórico clínico" },
  { q: "Última vez?", section: "Histórico clínico" },
  { q: "A que?", section: "Histórico clínico" },
  { q: "Qual(is)?", section: "Histórico clínico" },
  { q: "Houve alguma alteração no último exame?", section: "Histórico clínico" },
  { q: "Histórico de doença na família?", section: "Histórico clínico" },
  // Saúde feminina
  { q: "Como é sua menstruação?", section: "Saúde feminina" },
  { q: "Usa anticoncepcional?", section: "Saúde feminina" },
  { q: "Faz uso de DIU?", section: "Saúde feminina" },
  { q: "Pode estar grávida?", section: "Saúde feminina" },
  { q: "Já ficou grávida?", section: "Saúde feminina" },
  { q: "Sofreu aborto?", section: "Saúde feminina" },
  { q: "Possui ou sofre alguma das opções abaixo?", section: "Saúde geral" },
  // Suplementação
  { q: "Possui deficiência de vitaminas?", section: "Suplementação e medicação" },
  { q: "Quais vitaminas?", section: "Suplementação e medicação" },
  { q: "Faz reposição?", section: "Suplementação e medicação" },
  { q: "Com?", section: "Suplementação e medicação" },
  { q: "Faz uso de antidepressivo?", section: "Suplementação e medicação" },
  { q: "Qual antidepressivo?", section: "Suplementação e medicação" },
  // Postura
  { q: "Permanece muito tempo sentado?", section: "Hábitos" },
  { q: "Horas:", section: "Hábitos" },
  // Doenças e condições
  { q: "Possui marcapasso?", section: "Doenças e condições" },
  { q: "Possui anemia?", section: "Doenças e condições" },
  { q: "Possui algum problema circulatório?", section: "Doenças e condições" },
  { q: "Possui diabetes?", section: "Doenças e condições" },
  { q: "Possui algum distúrbio hormonal?", section: "Doenças e condições" },
  { q: "Possui lúpus?", section: "Doenças e condições" },
  { q: "Possui psoríase?", section: "Doenças e condições" },
  { q: "Cabelos e/ou unhas quebradiços?", section: "Doenças e condições" },
  { q: "Possui algum distúrbio na tireoide?", section: "Doenças e condições" },
  { q: "Distúrbio hepático (fígado)?", section: "Doenças e condições" },
  { q: "Distúrbio renal (rins)?", section: "Doenças e condições" },
  { q: "Tumor?", section: "Doenças e condições" },
  { q: "Quando?", section: "Doenças e condições" },
  { q: "Possui algum problema gástrico?", section: "Doenças e condições" },
  { q: "Gastrite?", section: "Doenças e condições" },
  { q: "Refluxo?", section: "Doenças e condições" },
  { q: "Faz tratamento?", section: "Doenças e condições" },
  { q: "Possui algum problema de cicatrização?", section: "Doenças e condições" },
  { q: "Tem histórico de cicatriz hipertrófica?", section: "Doenças e condições" },
  { q: "Possui mioma?", section: "Saúde feminina" },
  { q: "Cisto no ovário?", section: "Saúde feminina" },
  { q: "Endometriose?", section: "Saúde feminina" },
  { q: "Queloide?", section: "Doenças e condições" },
  { q: "Tem ou teve herpes labial ou em outro lugar do rosto?", section: "Doenças e condições" },
  { q: "Onde teve herpes labial?", section: "Doenças e condições" },
  { q: "Como é sua pressão arterial?", section: "Doenças e condições" },
  { q: "Faz controle da pressão arterial?", section: "Doenças e condições" },
  { q: "É ansioso?", section: "Saúde mental" },
  { q: "É estressado?", section: "Saúde mental" },
  { q: "Teve Covid?", section: "Doenças e condições" },
  { q: "Tomou vacina?", section: "Doenças e condições" },
  { q: "Quando tomou vacina?", section: "Doenças e condições" },
  { q: "Com qual medicação?", section: "Histórico clínico" },
  { q: "Sua gengiva costuma sangrar?", section: "Doenças e condições" },
  { q: "Possui alguma doença ou há alguma informação que não foi perguntada que deseja informar?", section: "Saúde geral" },
  { q: "Fale sobre:", section: "Saúde geral" },
];

const ESTETICA: SeedTemplate = {
  slug: "estetica",
  name: "Anamnese Estética",
  description: "Avaliação clínica completa para procedimentos estéticos (121 perguntas).",
  questions: ESTETICA_QUESTIONS_RAW.map(({ q, section }) => ({
    question: q,
    type: "select",
    options: SIM_NAO_NAOSEI,
    hasExtra: true,
    extraLabel: "Informações adicionais",
    section,
  })),
};

// ─────────────────────────────────────────────────────────────
// 3) ANAMNESE CO2 FRACIONADO
// ─────────────────────────────────────────────────────────────
const CO2: SeedTemplate = {
  slug: "co2",
  name: "Anamnese CO2 Fracionado",
  description: "Triagem específica para laser CO2 fracionado (24 perguntas).",
  questions: [
    radio("Possui alguma alergia? (como penicilinas, AAS ou outra)", SIM_NAO_NAOSEI, "Saúde geral"),
    radio("Possui diabetes?", SIM_NAO_NAOSEI, "Saúde geral"),
    radio("Já sofreu alguma reação alérgica ao receber anestesia?", SIM_NAO_NAOSEI, "Saúde geral"),
    radio("Está grávida?", SIM_NAO_NAOSEI, "Saúde geral"),
    textArea("Queixa principal", "Avaliação da pele"),
    textArea("O que mais te incomoda na sua pele?", "Avaliação da pele"),
    radioExtra("Já realizou algum tratamento estético facial?", "Informações adicionais", SIM_NAO_NAOSEI, "Histórico estético"),
    radioExtra("Já fez laser anteriormente?", "Informações adicionais", SIM_NAO_NAOSEI, "Histórico estético"),
    textArea("Como você classifica sua pele? (oleosa, seca, mista, sensível)", "Avaliação da pele"),
    radio("Apresenta tendências a manchas?", SIM_NAO_NAOSEI, "Avaliação da pele"),
    radio("Já teve melasma?", SIM_NAO_NAOSEI, "Avaliação da pele"),
    radio("Costuma ter acne ativa?", SIM_NAO_NAOSEI, "Avaliação da pele"),
    radioExtra("Se expõe ao sol com frequência?", "Informações adicionais", SIM_NAO_NAOSEI, "Hábitos"),
    radio("Usa protetor solar diariamente?", SIM_NAO_NAOSEI, "Hábitos"),
    radio("Já se bronzeou recentemente (últimos 15 dias)?", SIM_NAO_NAOSEI, "Hábitos"),
    radio("Usou recentemente isotretinoína (Roacutan)?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radio("Tem doenças autoimunes?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radio("Está com alguma infecção ativa na pele?", SIM_NAO_NAOSEI, "Avaliação da pele"),
    radio("Herpes recorrente?", SIM_NAO_NAOSEI, "Histórico clínico"),
    radio("Uso recente de ácidos ou peelings?", SIM_NAO_NAOSEI, "Histórico estético"),
    radio("Faz procedimentos recentes na face (últimos 30 dias)?", SIM_NAO_NAOSEI, "Histórico estético"),
    textArea("O que você espera melhorar no tratamento?", "Expectativas"),
    radio("Está disposto(a) a realizar um período de recuperação?", SIM_NAO_NAOSEI, "Expectativas"),
    radio("Entende que os resultados são progressivos e dependem de resposta individual?", SIM_NAO_NAOSEI, "Expectativas"),
  ],
};

const TEMPLATES: SeedTemplate[] = [HOF, ESTETICA, CO2];

// ─────────────────────────────────────────────────────────────
// Seeder — idempotente por (tenantId, slug)
// ─────────────────────────────────────────────────────────────
export async function seedDefaultAnamneseTemplates(tenantId: number): Promise<{ created: string[]; skipped: string[] }> {
  const db = await getDb();
  if (!db) return { created: [], skipped: [] };

  const created: string[] = [];
  const skipped: string[] = [];

  for (const tpl of TEMPLATES) {
    // Já existe?
    const existing = await db.execute(sql`
      SELECT id FROM anamnesis_templates
      WHERE "tenantId" = ${tenantId} AND "slug" = ${tpl.slug}
      LIMIT 1
    `);
    if ((existing.rows as any[]).length > 0) {
      skipped.push(tpl.slug);
      continue;
    }

    const inserted = await db.execute(sql`
      INSERT INTO anamnesis_templates ("tenantId", "slug", "name", "description", "isDefault")
      VALUES (${tenantId}, ${tpl.slug}, ${tpl.name}, ${tpl.description}, ${tpl.isDefault || false})
      RETURNING id
    `);
    const templateId = (inserted.rows as any[])[0].id as number;

    for (let i = 0; i < tpl.questions.length; i++) {
      const q = tpl.questions[i]!;
      const optsJson = q.options ? JSON.stringify(q.options) : null;
      await db.execute(sql`
        INSERT INTO anamnesis_questions
          ("templateId", "tenantId", "section", "question", "questionType", "options", "isRequired", "hasExtraField", "extraFieldLabel", "sortOrder")
        VALUES
          (${templateId}, ${tenantId}, ${q.section || null}, ${q.question},
           ${q.type}::"anamnesis_question_type",
           ${optsJson ? sql`${optsJson}::json` : sql`NULL`},
           false, ${q.hasExtra || false}, ${q.extraLabel || null}, ${i + 1})
      `);
    }
    created.push(tpl.slug);
  }

  return { created, skipped };
}
