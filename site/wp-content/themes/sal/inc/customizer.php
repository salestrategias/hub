<?php
/**
 * Personalizar (Customizer): tudo que muda com frequência é editável
 * sem tocar em código — textos da home, números, contato e redes.
 *
 * Cada campo tem sanitização explícita e transporte refresh (simples e à prova de erro).
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Valores padrão centralizados — usados pelo Customizer e pelos templates.
 */
function sal_padroes(): array {
	return array(
		// Hero.
		'sal_hero_kicker'  => __( 'Para e-commerce e varejo local', 'sal' ),
		'sal_hero_titulo'  => __( 'Marketing que aparece nas vendas, não só no relatório.', 'sal' ),
		'sal_hero_sub'     => __( 'A SAL planeja e executa o marketing da sua loja, física ou virtual, e mostra todo mês o que cada real investido trouxe de volta.', 'sal' ),
		'sal_hero_nota'    => __( 'Diagnóstico gratuito, sem compromisso. Resposta em até 1 dia útil.', 'sal' ),
		'sal_hero_aside_1' => __( 'Sem pacote de prateleira: o plano sai do diagnóstico do seu negócio, do seu ticket e da sua margem.', 'sal' ),
		'sal_hero_aside_2' => __( 'Você acompanha tudo em relatórios que fecham a conta: investimento, retorno e o que vem no próximo mês.', 'sal' ),

		// CTA principal.
		'sal_cta_texto'    => __( 'Pedir diagnóstico gratuito', 'sal' ),
		'sal_cta_url'      => '/diagnostico/',

		// Números de prova.
		'sal_num1_valor'   => '10+',
		'sal_num1_rotulo'  => __( 'anos de estrada em marketing digital', 'sal' ),
		'sal_num2_valor'   => '2',
		'sal_num2_rotulo'  => __( 'especialidades: e-commerce e varejo local, e nada além disso', 'sal' ),
		'sal_num3_valor'   => '1',
		'sal_num3_rotulo'  => __( 'relatório por mês que fecha a conta em reais, sem métrica de vaidade', 'sal' ),

		// Depoimento.
		'sal_depo_texto'   => __( 'Pela primeira vez eu sei exatamente quanto o marketing devolve pra loja. A conta fecha, e sobra.', 'sal' ),
		'sal_depo_autor'   => __( 'Cliente SAL · varejo local', 'sal' ),

		// CTA final.
		'sal_final_titulo' => __( 'Quer saber onde sua loja está deixando dinheiro na mesa?', 'sal' ),
		'sal_final_texto'  => __( 'Peça o diagnóstico gratuito: a gente analisa seu funil, seus canais e seus números e devolve um plano claro, mesmo que você não feche com a SAL.', 'sal' ),

		// Contato e redes.
		'sal_whatsapp'     => '',
		'sal_email'        => 'contato@salestrategias.com.br',
		'sal_instagram'    => '',
		'sal_linkedin'     => '',
		'sal_substack'     => 'https://marcelofreitas.substack.com',

		// SEO da home (usado só sem plugin de SEO ativo).
		'sal_meta_descricao' => __( 'Agência de marketing para e-commerce e varejo local. Tráfego pago, SEO e retenção com relatório que fecha a conta em reais. Diagnóstico gratuito.', 'sal' ),
	);
}

/**
 * Atalho: theme_mod já com padrão aplicado.
 */
function sal_mod( string $chave ): string {
	$padroes = sal_padroes();
	return (string) get_theme_mod( $chave, $padroes[ $chave ] ?? '' );
}

add_action( 'customize_register', function ( WP_Customize_Manager $wp_customize ) {
	$padroes = sal_padroes();

	$painel = 'sal_painel';
	$wp_customize->add_panel( $painel, array(
		'title'    => __( 'SAL — conteúdo do site', 'sal' ),
		'priority' => 10,
	) );

	$secoes = array(
		'sal_sec_hero'    => __( 'Home · Abertura (hero)', 'sal' ),
		'sal_sec_numeros' => __( 'Home · Números', 'sal' ),
		'sal_sec_depo'    => __( 'Home · Depoimento', 'sal' ),
		'sal_sec_final'   => __( 'Home · Chamada final', 'sal' ),
		'sal_sec_contato' => __( 'Contato e redes', 'sal' ),
		'sal_sec_seo'     => __( 'SEO da home', 'sal' ),
	);
	foreach ( $secoes as $id => $titulo ) {
		$wp_customize->add_section( $id, array( 'title' => $titulo, 'panel' => $painel ) );
	}

	// [setting, seção, rótulo, tipo] — tipo: text | textarea | url | email.
	$campos = array(
		'sal_hero_kicker'    => array( 'sal_sec_hero', __( 'Etiqueta acima do título', 'sal' ), 'text' ),
		'sal_hero_titulo'    => array( 'sal_sec_hero', __( 'Título', 'sal' ), 'textarea' ),
		'sal_hero_sub'       => array( 'sal_sec_hero', __( 'Subtítulo', 'sal' ), 'textarea' ),
		'sal_cta_texto'      => array( 'sal_sec_hero', __( 'Texto do botão principal', 'sal' ), 'text' ),
		'sal_cta_url'        => array( 'sal_sec_hero', __( 'Link do botão principal', 'sal' ), 'text' ),
		'sal_hero_nota'      => array( 'sal_sec_hero', __( 'Nota abaixo dos botões', 'sal' ), 'text' ),
		'sal_hero_aside_1'   => array( 'sal_sec_hero', __( 'Coluna lateral — parágrafo 1', 'sal' ), 'textarea' ),
		'sal_hero_aside_2'   => array( 'sal_sec_hero', __( 'Coluna lateral — parágrafo 2', 'sal' ), 'textarea' ),

		'sal_num1_valor'     => array( 'sal_sec_numeros', __( 'Número 1 — valor', 'sal' ), 'text' ),
		'sal_num1_rotulo'    => array( 'sal_sec_numeros', __( 'Número 1 — legenda', 'sal' ), 'text' ),
		'sal_num2_valor'     => array( 'sal_sec_numeros', __( 'Número 2 — valor', 'sal' ), 'text' ),
		'sal_num2_rotulo'    => array( 'sal_sec_numeros', __( 'Número 2 — legenda', 'sal' ), 'text' ),
		'sal_num3_valor'     => array( 'sal_sec_numeros', __( 'Número 3 — valor', 'sal' ), 'text' ),
		'sal_num3_rotulo'    => array( 'sal_sec_numeros', __( 'Número 3 — legenda', 'sal' ), 'text' ),

		'sal_depo_texto'     => array( 'sal_sec_depo', __( 'Frase do depoimento (vazio = seção some)', 'sal' ), 'textarea' ),
		'sal_depo_autor'     => array( 'sal_sec_depo', __( 'Autor do depoimento', 'sal' ), 'text' ),

		'sal_final_titulo'   => array( 'sal_sec_final', __( 'Título', 'sal' ), 'textarea' ),
		'sal_final_texto'    => array( 'sal_sec_final', __( 'Texto', 'sal' ), 'textarea' ),

		'sal_whatsapp'       => array( 'sal_sec_contato', __( 'WhatsApp (só dígitos, com DDI: 5511999999999)', 'sal' ), 'text' ),
		'sal_email'          => array( 'sal_sec_contato', __( 'E-mail de contato', 'sal' ), 'email' ),
		'sal_instagram'      => array( 'sal_sec_contato', __( 'Instagram (URL completa)', 'sal' ), 'url' ),
		'sal_linkedin'       => array( 'sal_sec_contato', __( 'LinkedIn (URL completa)', 'sal' ), 'url' ),
		'sal_substack'       => array( 'sal_sec_contato', __( 'Newsletter Substack (URL da publicação)', 'sal' ), 'url' ),

		'sal_meta_descricao' => array( 'sal_sec_seo', __( 'Meta description da home (até ~155 caracteres)', 'sal' ), 'textarea' ),
	);

	$sanitizadores = array(
		'text'     => 'sanitize_text_field',
		'textarea' => 'sanitize_textarea_field',
		'url'      => 'esc_url_raw',
		'email'    => 'sanitize_email',
	);

	foreach ( $campos as $id => list( $secao, $rotulo, $tipo ) ) {
		$wp_customize->add_setting( $id, array(
			'default'           => $padroes[ $id ] ?? '',
			'sanitize_callback' => $sanitizadores[ $tipo ],
			'transport'         => 'refresh',
		) );
		$wp_customize->add_control( $id, array(
			'section' => $secao,
			'label'   => $rotulo,
			'type'    => 'textarea' === $tipo ? 'textarea' : ( 'url' === $tipo ? 'url' : ( 'email' === $tipo ? 'email' : 'text' ) ),
		) );
	}
} );
