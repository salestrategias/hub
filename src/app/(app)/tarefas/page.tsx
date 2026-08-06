import { redirect } from "next/navigation";

/**
 * Hub 2.0 F2 — /tarefas foi absorvida pelo quadro "Hoje" (home).
 * A lista antiga virou o kanban; bookmarks continuam funcionando via
 * este redirect. O detalhe da tarefa segue acessível de qualquer tela
 * pela TarefaSheet (?tarefa=id).
 */
export default function TarefasPage() {
  redirect("/");
}
