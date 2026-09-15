<?php
/**
 * CSS e JS do tema.
 *
 * Um arquivo de CSS (style.css) e um de JS (~2 KB, vanilla, defer).
 * Versão por filemtime = cache busting automático a cada deploy.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_enqueue_scripts', function () {
	// Fontes primeiro, em arquivo próprio: sobrevive a minificação (ver fontes.css).
	$fontes_path = get_template_directory() . '/assets/css/fontes.css';
	if ( file_exists( $fontes_path ) ) {
		wp_enqueue_style( 'sal-fontes', get_template_directory_uri() . '/assets/css/fontes.css', array(), (string) filemtime( $fontes_path ) );
	}

	$css_ver = (string) filemtime( get_template_directory() . '/style.css' );
	wp_enqueue_style( 'sal-estilo', get_stylesheet_uri(), array( 'sal-fontes' ), $css_ver );

	$js_path = get_template_directory() . '/assets/js/main.js';
	if ( file_exists( $js_path ) ) {
		wp_enqueue_script(
			'sal-js',
			get_template_directory_uri() . '/assets/js/main.js',
			array(),
			(string) filemtime( $js_path ),
			array( 'strategy' => 'defer', 'in_footer' => true )
		);
	}
} );

/**
 * Preload das duas fontes variáveis: começa o download antes do CSS chegar.
 * As regras @font-face vivem em assets/css/fontes.css (com caminho absoluto).
 */
add_action( 'wp_head', function () {
	$base = esc_url( get_template_directory_uri() ) . '/assets/fonts';
	echo '<link rel="preload" href="' . $base . '/plus-jakarta-sans-var.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
	echo '<link rel="preload" href="' . $base . '/inter-var.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
}, 2 );

/**
 * O CSS do tema não pode ser adiado nem removido por otimizador: sem ele a
 * página fica sem estilo nenhum. Marca os handles do tema como críticos.
 */
add_filter( 'rocket_exclude_defer_css', function ( $excluded ) {
	$excluded[] = 'themes/sal/style.css';
	$excluded[] = 'themes/sal/assets/css/fontes.css';
	return $excluded;
} );
add_filter( 'rocket_exclude_css', function ( $excluded ) {
	$excluded[] = 'themes/sal/assets/css/fontes.css';
	return $excluded;
} );
