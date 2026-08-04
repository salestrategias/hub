<?php
/** Cabeçalho: o mesmo do site estático, com o Blog marcado como ativo. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="icon" href="/favicon.svg" type="image/svg+xml">
	<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
	<meta name="theme-color" content="#0B0A18">
	<link rel="preload" href="<?php echo esc_url( get_template_directory_uri() ); ?>/fonts/newsreader-var.woff2" as="font" type="font/woff2" crossorigin>
	<link rel="preload" href="<?php echo esc_url( get_template_directory_uri() ); ?>/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<header class="topo">
	<div class="wrap">
		<a href="/" aria-label="SAL Estratégias de Marketing">
			<img src="/img/logo-sal-branco.svg" alt="SAL Estratégias de Marketing" width="60" height="34">
		</a>
		<button class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
		<nav class="nav" id="nav" aria-label="Menu principal">
			<a href="/seo-local/">SEO local</a>
			<a href="/seo-para-ecommerce/">SEO para e-commerce</a>
			<a href="/trafego-pago/">Tráfego pago</a>
			<a href="/quem-somos/">A SAL</a>
			<a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>" aria-current="<?php echo is_singular( 'post' ) ? 'false' : 'page'; ?>" class="ativo">Blog</a>
			<a class="btn btn-primary" href="<?php echo esc_url( SAL_AGENDA ); ?>">Agendar diagnóstico ↗</a>
		</nav>
	</div>
</header>
