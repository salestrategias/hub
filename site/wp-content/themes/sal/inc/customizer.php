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
		// Hero (headline e subtítulo do site atual, escritos pelo Marcelo).
		'sal_hero_kicker'  => __( 'Assessoria para varejo e e-commerce', 'sal' ),
		'sal_hero_titulo'  => __( 'Marketing que faz varejo e e-commerce vender mais e ser lembrado.', 'sal' ),
		'sal_hero_sub'     => __( 'Assessoria de marketing com método. SEO, tráfego pago, sites e marca trabalhando juntos, da pesquisa ao resultado. A SAL cuida do crescimento da sua marca por inteiro.', 'sal' ),
		'sal_hero_nota'    => __( 'Diagnóstico gratuito, sem compromisso. Resposta em até 1 dia útil.', 'sal' ),
		'sal_hero_aside_1' => __( 'Nada aqui é pacote de prateleira: o plano sai do diagnóstico do seu negócio, do seu ticket e da sua margem.', 'sal' ),
		'sal_hero_aside_2' => __( 'E todo mês você recebe um relatório que fecha a conta: quanto foi investido, quanto voltou e o que vem no mês seguinte.', 'sal' ),

		// CTA principal.
		'sal_cta_texto'    => __( 'Pedir diagnóstico gratuito', 'sal' ),
		'sal_cta_url'      => '/diagnostico/',

		// Números de prova.
		'sal_num1_valor'   => '10+',
		'sal_num1_rotulo'  => __( 'anos de experiência em marketing, do ensino superior ao varejo', 'sal' ),
		'sal_num2_valor'   => '2',
		'sal_num2_rotulo'  => __( 'mercados atendidos, por escolha: varejo e e-commerce', 'sal' ),
		'sal_num3_valor'   => '1',
		'sal_num3_rotulo'  => __( 'relatório por mês, com a conta fechada em reais', 'sal' ),

		// Depoimento: vazio por padrão. Só publicar depoimento real, com autorização.
		'sal_depo_texto'   => '',
		'sal_depo_autor'   => '',

		// CTA final (headline da página de diagnóstico atual, escrita pelo Marcelo).
		'sal_final_titulo' => __( 'Onde o seu marketing está travando?', 'sal' ),
		'sal_final_texto'  => __( 'Em poucas perguntas, o Diagnóstico SAL devolve uma leitura do que falta no marketing do seu varejo ou e-commerce. Gratuito, sem compromisso, com resposta em até 1 dia útil.', 'sal' ),

		// Contato e redes (valores reais do site atual; ajustáveis no Personalizar).
		'sal_whatsapp'     => '5551993380278',
		'sal_email'        => 'contato@salestrategias.com.br',
		'sal_instagram'    => 'https://www.instagram.com/salestrategias/',
		'sal_linkedin'     => 'https://www.linkedin.com/company/sal-estrategias-de-marketing/',
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
