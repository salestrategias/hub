<?php
/**
 * Suportes do tema, menus e tamanhos de imagem.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'after_setup_theme', function () {
	load_theme_textdomain( 'sal', get_template_directory() . '/languages' );

	// SEO: título gerenciado pelo WP (ou pelo plugin de SEO, se ativo).
	add_theme_support( 'title-tag' );

	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'custom-logo', array(
		'height'      => 96,
		'width'       => 320,
		'flex-height' => true,
		'flex-width'  => true,
	) );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'align-wide' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'assets/css/editor.css' );

	register_nav_menus( array(
		'principal' => __( 'Menu principal', 'sal' ),
		'rodape'    => __( 'Menu do rodapé', 'sal' ),
	) );

	// Capa dos cards (16:9, recorte exato) — evita servir a imagem original gigante.
	add_image_size( 'sal-card', 720, 405, true );
} );

// Largura de conteúdo para embeds.
add_action( 'after_setup_theme', function () {
	$GLOBALS['content_width'] = 720;
}, 0 );

/**
 * Excerpt: tamanho e final limpos para os cards.
 */
add_filter( 'excerpt_length', fn () => 24, 999 );
add_filter( 'excerpt_more', fn () => '…' );
