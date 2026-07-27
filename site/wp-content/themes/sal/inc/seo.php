<?php
/**
 * SEO de fallback: meta description, Open Graph/Twitter e schema.org.
 *
 * O site usa Rank Math no blog. Quando um plugin de SEO (Rank Math, Yoast
 * ou SEOPress) está ativo, TUDO aqui se desliga para não duplicar tags.
 * Sem plugin, o tema entrega o essencial sozinho.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Há plugin de SEO cuidando das metas?
 */
function sal_tem_plugin_seo(): bool {
	return class_exists( 'RankMath' )
		|| defined( 'WPSEO_VERSION' )
		|| defined( 'SEOPRESS_VERSION' );
}

/**
 * Descrição da página atual (para meta description e og:description).
 */
function sal_meta_descricao(): string {
	if ( is_front_page() ) {
		$desc = get_theme_mod( 'sal_meta_descricao', get_bloginfo( 'description' ) );
	} elseif ( is_singular() ) {
		$post = get_queried_object();
		$desc = has_excerpt( $post ) ? get_the_excerpt( $post ) : wp_trim_words( wp_strip_all_tags( $post->post_content ), 30, '…' );
	} elseif ( is_category() || is_tag() || is_tax() ) {
		$desc = term_description() ?: get_bloginfo( 'description' );
	} else {
		$desc = get_bloginfo( 'description' );
	}
	return trim( wp_strip_all_tags( (string) $desc ) );
}

add_action( 'wp_head', function () {
	if ( sal_tem_plugin_seo() ) {
		return;
	}

	$descricao = sal_meta_descricao();
	$titulo    = wp_get_document_title();
	$url       = is_singular() ? get_permalink() : home_url( add_query_arg( array(), $GLOBALS['wp']->request ?? '' ) );

	if ( $descricao ) {
		echo '<meta name="description" content="' . esc_attr( $descricao ) . '">' . "\n";
	}

	// Open Graph + Twitter Card.
	echo '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">' . "\n";
	echo '<meta property="og:title" content="' . esc_attr( $titulo ) . '">' . "\n";
	echo '<meta property="og:type" content="' . ( is_singular( 'post' ) ? 'article' : 'website' ) . '">' . "\n";
	echo '<meta property="og:url" content="' . esc_url( $url ) . '">' . "\n";
	echo '<meta property="og:locale" content="pt_BR">' . "\n";
	if ( $descricao ) {
		echo '<meta property="og:description" content="' . esc_attr( $descricao ) . '">' . "\n";
	}
	if ( is_singular() && has_post_thumbnail() ) {
		$img = wp_get_attachment_image_src( get_post_thumbnail_id(), 'large' );
		if ( $img ) {
			echo '<meta property="og:image" content="' . esc_url( $img[0] ) . '">' . "\n";
			echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
		}
	} else {
		echo '<meta name="twitter:card" content="summary">' . "\n";
	}
}, 5 );

/**
 * JSON-LD: Organization + WebSite na home, Article nos posts.
 */
add_action( 'wp_head', function () {
	if ( sal_tem_plugin_seo() ) {
		return;
	}

	$schemas = array();

	if ( is_front_page() ) {
		$schemas[] = array(
			'@type'  => 'Organization',
			'@id'    => home_url( '/#organizacao' ),
			'name'   => get_bloginfo( 'name' ),
			'url'    => home_url( '/' ),
			'slogan' => 'Marketing na Medida Certa',
			'sameAs' => array_values( array_filter( array(
				get_theme_mod( 'sal_instagram', '' ),
				get_theme_mod( 'sal_linkedin', '' ),
			) ) ),
		);
		$schemas[] = array(
			'@type' => 'WebSite',
			'@id'   => home_url( '/#site' ),
			'name'  => get_bloginfo( 'name' ),
			'url'   => home_url( '/' ),
		);
	}

	if ( is_singular( 'post' ) ) {
		$post   = get_queried_object();
		$artigo = array(
			'@type'         => 'Article',
			'headline'      => get_the_title( $post ),
			'datePublished' => get_the_date( 'c', $post ),
			'dateModified'  => get_the_modified_date( 'c', $post ),
			'author'        => array(
				'@type' => 'Organization',
				'name'  => get_bloginfo( 'name' ),
				'url'   => home_url( '/' ),
			),
			'mainEntityOfPage' => get_permalink( $post ),
		);
		if ( has_post_thumbnail( $post ) ) {
			$img = wp_get_attachment_image_src( get_post_thumbnail_id( $post ), 'large' );
			if ( $img ) {
				$artigo['image'] = $img[0];
			}
		}
		$schemas[] = $artigo;
	}

	if ( ! $schemas ) {
		return;
	}

	$json = array( '@context' => 'https://schema.org', '@graph' => $schemas );
	echo '<script type="application/ld+json">' . wp_json_encode( $json, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
}, 6 );

/**
 * Separador do <title> ("Página · SAL").
 */
add_filter( 'document_title_separator', fn () => '·' );

/**
 * Expõe os campos do Rank Math na REST API também para páginas.
 *
 * O snippet do blog (wpcode-rankmath-rest.php) registra só para 'post', o que
 * deixa as páginas do site sem title tag e meta description editáveis via API.
 */
add_action( 'init', function () {
	if ( ! sal_tem_plugin_seo() ) {
		return;
	}
	$campos = array(
		'rank_math_title'         => 'string',
		'rank_math_description'   => 'string',
		'rank_math_focus_keyword' => 'string',
	);
	foreach ( $campos as $campo => $tipo ) {
		register_post_meta( 'page', $campo, array(
			'show_in_rest'  => true,
			'single'        => true,
			'type'          => $tipo,
			'auth_callback' => fn () => current_user_can( 'edit_pages' ),
		) );
	}
} );
