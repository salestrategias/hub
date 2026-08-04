<?php
/**
 * SAL Blog — funções do tema.
 *
 * O tema desenha só o que o WordPress ainda serve: o portal (/blog/), os
 * artigos, as editorias, a busca e o 404. As páginas institucionais são o
 * site estático, servido pelo nginx antes de chegar aqui.
 *
 * Título, meta description, canonical, Open Graph e schema são do Rank Math.
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

// GA4 da SAL. A medição só carrega depois do aceite na barra de cookies,
// e a escolha é a mesma do site (localStorage 'sal-cookies').
define( 'SAL_GA_ID', 'G-DVRZ7L908H' );

define( 'SAL_ZAP', 'https://wa.me/5551993380278' );
define( 'SAL_AGENDA', '/agenda/' );
define( 'SAL_SUBSTACK', 'https://marcelofreitas.substack.com/subscribe' );

// ---------------------------------------------------------------- suportes
add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );

	// Capas: o card usa 640 de largura; o Discover pede imagem grande, e para
	// isso vale a original (via Rank Math/og:image) — não geramos recorte extra.
	add_image_size( 'sal-card', 640, 360, true );
	set_post_thumbnail_size( 1200, 675, true );
} );

// ---------------------------------------------------------------- assets
add_action( 'wp_enqueue_scripts', function () {
	$v_css = filemtime( get_template_directory() . '/style.css' );
	$v_js  = filemtime( get_template_directory() . '/js/tema.js' );
	wp_enqueue_style( 'sal-blog', get_stylesheet_uri(), array(), $v_css );
	wp_enqueue_script( 'sal-blog', get_template_directory_uri() . '/js/tema.js', array(), $v_js, true );
	wp_localize_script( 'sal-blog', 'SAL', array( 'ga' => SAL_GA_ID ) );
}, 20 );

// O blog não usa Elementor, ElementsKit, Font Awesome nem o CSS de blocos.
// Medido antes do tema: 1,3 MB de CSS bloqueando a primeira pintura.
// A limpeza roda duas vezes — no enfileiramento normal e de novo na hora de
// imprimir — porque o Elementor enfileira coisas tarde, ao renderizar.
function sal_limpar_filas() {
	$descartar = array(
		'/plugins/elementor', '/plugins/elementskit', '/plugins/gum-elementor-addon',
		'/uploads/elementor', 'font-awesome', 'owl.carousel', 'ekiticons', '/plugins/metform',
		'/cache/fonts/',   // Google Fonts locais do kit antigo (Gloock e afins)
	);
	foreach ( array( wp_styles(), wp_scripts() ) as $fila ) {
		foreach ( (array) $fila->queue as $handle ) {
			$src = isset( $fila->registered[ $handle ] ) ? (string) $fila->registered[ $handle ]->src : '';
			foreach ( $descartar as $trecho ) {
				if ( $src && strpos( $src, $trecho ) !== false ) {
					( $fila instanceof WP_Styles ) ? wp_dequeue_style( $handle ) : wp_dequeue_script( $handle );
					break;
				}
			}
		}
	}
	wp_dequeue_style( 'wp-block-library' );
	wp_dequeue_style( 'wp-block-library-theme' );
	wp_dequeue_style( 'classic-theme-styles' );
	wp_dequeue_style( 'global-styles' );
}
add_action( 'wp_enqueue_scripts', 'sal_limpar_filas', 100 );
add_action( 'wp_print_styles', 'sal_limpar_filas', 99 );
add_action( 'wp_print_footer_scripts', 'sal_limpar_filas', 1 );

// O Elementor Pro tem templates de Theme Builder (arquivo, single, header,
// footer) com condições sobre o blog, e eles passam por cima do tema ativo.
// Duas defesas, porque os caminhos são diferentes:
//   1. o filtro corta a sobreposição de templates de página (arquivo/single)
//   2. registrar uma lista VAZIA de locations tira do header e do footer do
//      Theme Builder qualquer lugar onde desenhar — é o mecanismo documentado
//      pelo próprio Elementor para temas que não os querem
add_filter( 'elementor/theme/need_override_location', '__return_false' );
add_action( 'elementor/theme/register_locations', function ( $manager ) {
	// de propósito: nenhum local registrado
} );

// ---------------------------------------------------------------- limpeza
add_action( 'init', function () {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'wp_head', 'wp_generator' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'rsd_link' );
	remove_action( 'wp_head', 'wp_shortlink_wp_head' );
} );

// Editorias com 12 artigos por página.
add_action( 'pre_get_posts', function ( $q ) {
	if ( ! is_admin() && $q->is_main_query() && ( $q->is_category() || $q->is_search() ) ) {
		$q->set( 'posts_per_page', 12 );
	}
} );

// ---------------------------------------------------------------- ajudantes
/** Minutos de leitura, no mínimo 1. */
function sal_leitura( $post = null ) {
	$post = get_post( $post );
	$palavras = str_word_count( wp_strip_all_tags( (string) $post->post_content ) );
	return max( 1, (int) round( $palavras / 200 ) );
}

/** Primeira categoria do post (para o rótulo do card). */
function sal_categoria( $post = null ) {
	$cats = get_the_category( $post );
	foreach ( $cats as $c ) {
		if ( 'uncategorized' !== $c->slug ) { return $c; }
	}
	return $cats ? $cats[0] : null;
}

/** Data por extenso, sem hora. */
function sal_data( $post = null ) {
	return get_the_date( 'j \d\e F \d\e Y', $post );
}

/** Editorias reais com artigo publicado, maiores primeiro. */
function sal_editorias() {
	return get_categories( array( 'hide_empty' => true, 'orderby' => 'count', 'order' => 'DESC', 'exclude' => array( 1 ) ) );
}
