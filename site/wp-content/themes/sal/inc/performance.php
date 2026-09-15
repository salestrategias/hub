<?php
/**
 * Performance: cabeçalho enxuto e zero requisições desnecessárias.
 *
 * Nada aqui muda comportamento visível do site — só remove peso.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', function () {
	// Emojis: o script + estilos somam ~15 KB e ninguém sente falta.
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'admin_print_scripts', 'print_emoji_detection_script' );
	remove_action( 'admin_print_styles', 'print_emoji_styles' );
	remove_filter( 'the_content_feed', 'wp_staticize_emoji' );
	remove_filter( 'comment_text_rss', 'wp_staticize_emoji' );
	remove_filter( 'wp_mail', 'wp_staticize_emoji_for_email' );
	add_filter( 'emoji_svg_url', '__return_false' );

	// Links de descoberta que só clientes antigos usavam.
	remove_action( 'wp_head', 'rsd_link' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'wp_shortlink_wp_head' );
	remove_action( 'wp_head', 'adjacent_posts_rel_link_wp_head' );
} );

/**
 * dns-prefetch do s.w.org (emojis) — sem emojis, sem prefetch.
 */
add_filter( 'wp_resource_hints', function ( $hints, $relation ) {
	if ( 'dns-prefetch' === $relation ) {
		$hints = array_diff( $hints, array( 'https://s.w.org/' ) );
	}
	return $hints;
}, 10, 2 );

/**
 * O tema não usa jQuery no front. Plugins que dependerem dele
 * o re-registram sozinhos via dependência — isto só evita carregar à toa.
 */
add_action( 'wp_enqueue_scripts', function () {
	if ( ! is_admin() ) {
		wp_dequeue_script( 'jquery' );
	}
}, 100 );

/**
 * Sem o CSS global de shortcode de galeria clássica (o tema já estiliza imagens).
 */
add_filter( 'use_default_gallery_style', '__return_false' );
