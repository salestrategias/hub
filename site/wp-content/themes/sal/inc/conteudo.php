<?php
/**
 * Componentes do portal: materiais ricos, FAQ com schema, CTA e newsletter.
 *
 * Shortcodes (usáveis em qualquer página ou post pelo editor):
 *  [sal_faq pergunta="..."]resposta[/sal_faq]   accordion + JSON-LD FAQPage automático
 *  [sal_cta titulo="..." texto="..." botao="..." url="..."]   bloco de CTA no meio do conteúdo
 *  [sal_newsletter titulo="..." texto="..."]    formulário de assinatura do Substack
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* -------------------------------------------------------------------------
 * CPT: Materiais ricos (checklists, planilhas, guias, vídeos)
 * ---------------------------------------------------------------------- */

add_action( 'init', function () {
	register_post_type( 'sal_material', array(
		'labels' => array(
			'name'          => __( 'Materiais', 'sal' ),
			'singular_name' => __( 'Material', 'sal' ),
			'add_new_item'  => __( 'Adicionar material', 'sal' ),
			'edit_item'     => __( 'Editar material', 'sal' ),
		),
		'public'       => true,
		'has_archive'  => 'materiais',
		'rewrite'      => array( 'slug' => 'materiais', 'with_front' => false ),
		'menu_icon'    => 'dashicons-download',
		'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
		'show_in_rest' => true,
	) );
} );

/**
 * Meta box: link do arquivo (Drive, PDF na media library, vídeo etc.).
 */
add_action( 'add_meta_boxes', function () {
	add_meta_box( 'sal_material_meta', __( 'Arquivo do material', 'sal' ), function ( $post ) {
		wp_nonce_field( 'sal_material_meta', 'sal_material_nonce' );
		$url = get_post_meta( $post->ID, 'sal_material_url', true );
		echo '<p><label for="sal_material_url">' . esc_html__( 'URL do arquivo (PDF, planilha, vídeo):', 'sal' ) . '</label></p>';
		echo '<input type="url" id="sal_material_url" name="sal_material_url" value="' . esc_attr( $url ) . '" style="width:100%">';
		echo '<p class="description">' . esc_html__( 'O botão "Baixar material" da página aponta para este link.', 'sal' ) . '</p>';
	}, 'sal_material', 'side' );
} );

add_action( 'save_post_sal_material', function ( $post_id ) {
	if ( ! isset( $_POST['sal_material_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['sal_material_nonce'] ), 'sal_material_meta' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	if ( isset( $_POST['sal_material_url'] ) ) {
		update_post_meta( $post_id, 'sal_material_url', esc_url_raw( wp_unslash( $_POST['sal_material_url'] ) ) );
	}
} );

/* -------------------------------------------------------------------------
 * FAQ: shortcode + JSON-LD FAQPage acumulado
 * ---------------------------------------------------------------------- */

/**
 * Acumula os pares pergunta/resposta da página para o schema.
 */
function sal_faq_registro( ?array $item = null ): array {
	static $itens = array();
	if ( $item ) {
		$itens[] = $item;
	}
	return $itens;
}

add_shortcode( 'sal_faq', function ( $atts, $conteudo = '' ) {
	$atts = shortcode_atts( array( 'pergunta' => '' ), $atts, 'sal_faq' );
	if ( ! $atts['pergunta'] || ! $conteudo ) {
		return '';
	}
	$resposta_html = do_shortcode( wpautop( $conteudo ) );
	sal_faq_registro( array(
		'pergunta' => wp_strip_all_tags( $atts['pergunta'] ),
		'resposta' => wp_strip_all_tags( $resposta_html ),
	) );
	return '<details class="faq"><summary>' . esc_html( $atts['pergunta'] ) . '</summary><div class="faq__resposta">' . wp_kses_post( $resposta_html ) . '</div></details>';
} );

/**
 * Imprime o FAQPage uma vez, no rodapé, se a página usou [sal_faq].
 * O Rank Math só gera FAQ schema via bloco Gutenberg próprio, então não duplica.
 */
add_action( 'wp_footer', function () {
	$itens = sal_faq_registro();
	if ( ! $itens ) {
		return;
	}
	$json = array(
		'@context'   => 'https://schema.org',
		'@type'      => 'FAQPage',
		'mainEntity' => array_map( fn ( $i ) => array(
			'@type'          => 'Question',
			'name'           => $i['pergunta'],
			'acceptedAnswer' => array( '@type' => 'Answer', 'text' => $i['resposta'] ),
		), $itens ),
	);
	echo '<script type="application/ld+json">' . wp_json_encode( $json, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
}, 20 );

/* -------------------------------------------------------------------------
 * CTA no meio do conteúdo
 * ---------------------------------------------------------------------- */

add_shortcode( 'sal_cta', function ( $atts ) {
	$atts = shortcode_atts( array(
		'titulo' => __( 'Quer aplicar isso na sua loja?', 'sal' ),
		'texto'  => __( 'Peça o Diagnóstico SAL: a gente analisa seus canais e seus números e devolve um parecer com prioridades.', 'sal' ),
		'botao'  => '',
		'url'    => '',
	), $atts, 'sal_cta' );

	$url   = $atts['url'] ?: sal_cta_url();
	$botao = $atts['botao'] ?: sal_mod( 'sal_cta_texto' );

	return '<div class="artigo-cta"><h2>' . esc_html( $atts['titulo'] ) . '</h2><p>' . esc_html( $atts['texto'] ) . '</p>'
		. '<a class="btn btn--claro" href="' . esc_url( $url ) . '">' . esc_html( $botao ) . ' <span class="seta" aria-hidden="true">→</span></a></div>';
} );

/* -------------------------------------------------------------------------
 * Newsletter (Substack) — formulário próprio, leve, sem iframe
 * ---------------------------------------------------------------------- */

/**
 * Formulário no visual SAL. GET para o /subscribe do Substack com o e-mail
 * pré-preenchido (o assinante confirma lá; sem CORS, sem script externo).
 */
function sal_newsletter_form( string $titulo = '', string $texto = '' ): string {
	$substack = rtrim( sal_mod( 'sal_substack' ), '/' );
	if ( ! $substack ) {
		return '';
	}
	$titulo = $titulo ?: __( 'Receba marketing na medida certa, por e-mail', 'sal' );
	$texto  = $texto ?: __( 'A newsletter do Marcelo Freitas: estratégias de marketing para varejo e e-commerce, sem enrolação e sem spam.', 'sal' );
	$id     = 'news-' . wp_unique_id();

	return '<div class="news">'
		. '<h2 class="news__titulo">' . esc_html( $titulo ) . '</h2>'
		. '<p class="news__texto">' . esc_html( $texto ) . '</p>'
		. '<form class="news__form" action="' . esc_url( $substack . '/subscribe' ) . '" method="get" target="_blank" rel="noopener">'
		. '<label class="screen-reader-text" for="' . esc_attr( $id ) . '">' . esc_html__( 'Seu e-mail', 'sal' ) . '</label>'
		. '<input type="email" id="' . esc_attr( $id ) . '" name="email" required placeholder="' . esc_attr__( 'seu@email.com', 'sal' ) . '">'
		. '<button type="submit" class="btn btn--solido">' . esc_html__( 'Assinar grátis', 'sal' ) . '</button>'
		. '</form>'
		. '<p class="news__nota">' . esc_html__( 'Você confirma a assinatura no Substack. Cancele quando quiser.', 'sal' ) . '</p>'
		. '</div>';
}

add_shortcode( 'sal_newsletter', function ( $atts ) {
	$atts = shortcode_atts( array( 'titulo' => '', 'texto' => '' ), $atts, 'sal_newsletter' );
	return sal_newsletter_form( $atts['titulo'], $atts['texto'] );
} );
