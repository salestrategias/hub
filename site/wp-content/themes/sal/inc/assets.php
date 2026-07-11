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
	$css_ver = (string) filemtime( get_template_directory() . '/style.css' );
	wp_enqueue_style( 'sal-estilo', get_stylesheet_uri(), array(), $css_ver );

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
 * Preload das duas fontes variáveis — elimina o "pulo" de fonte no primeiro paint.
 */
add_action( 'wp_head', function () {
	$base = esc_url( get_template_directory_uri() );
	echo '<link rel="preload" href="' . $base . '/assets/fonts/plus-jakarta-sans-var.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
	echo '<link rel="preload" href="' . $base . '/assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
}, 2 );
