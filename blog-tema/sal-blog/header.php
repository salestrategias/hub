<?php
/** Cabeçalho: o mesmo do site estático, com o Blog marcado como ativo. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
	<link rel="apple-touch-icon" href="/img/sal-touch.png">
	<meta name="theme-color" content="#0B1526">
	<script>
	(function () {
		try {
			if (localStorage.getItem('tema') === 'claro') {
				document.documentElement.setAttribute('data-tema', 'claro');
				var m = document.querySelector('meta[name="theme-color"]');
				if (m) m.setAttribute('content', '#F7F9FC');
			}
		} catch (e) {}
	})();
	</script>
	<link rel="preload" href="<?php echo esc_url( get_template_directory_uri() ); ?>/fonts/newsreader-600.woff2" as="font" type="font/woff2" crossorigin>
	<link rel="preload" href="<?php echo esc_url( get_template_directory_uri() ); ?>/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<header class="topo">
	<div class="wrap">
		<a href="/" aria-label="SAL Estratégias de Marketing">
			<img class="logo-escuro" src="/img/sal-wordmark.svg" alt="SAL Estratégias de Marketing" width="60" height="34">
			<img class="logo-claro" src="/img/sal-wordmark-tinta.svg" alt="SAL Estratégias de Marketing" width="60" height="34">
		</a>
		<nav class="nav" id="nav" aria-label="Menu principal">
			<details class="drop">
				<summary aria-label="Serviços da SAL">
					Serviços
					<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg>
				</summary>
				<div class="drop-caixa">
					<a href="/seo-local/">SEO local</a>
					<a href="/seo-para-ecommerce/">SEO para e-commerce</a>
					<a href="/trafego-pago/">Tráfego pago</a>
					<a href="/diagnostico-de-site/">Diagnóstico de site</a>
					<a href="/servicos/agencia-de-producao-de-conteudo/">Produção de conteúdo</a>
					<a class="drop-todos" href="/servicos/">Ver todos os serviços →</a>
				</div>
			</details>
			<a href="/quem-somos/">A SAL</a>
			<a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>" aria-current="<?php echo is_singular( 'post' ) ? 'false' : 'page'; ?>" class="ativo">Blog</a>
			<a class="btn btn-primary" href="<?php echo esc_url( SAL_AGENDA ); ?>">Contrate a SAL</a>
		</nav>
		<div class="topo-acoes">
			<button class="tema-btn" type="button" aria-label="Acender ou apagar a luz do site">
				<svg class="sol" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 17.5h5M10.2 20.5h3.6"/><path d="M12 3.5a5.6 5.6 0 0 0-3.2 10.2c.7.5 1.2 1.2 1.2 2v.3h4v-.3c0-.8.5-1.5 1.2-2A5.6 5.6 0 0 0 12 3.5Z"/></svg>
				<svg class="lua" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 17.5h5M10.2 20.5h3.6"/><path d="M12 3.5a5.6 5.6 0 0 0-3.2 10.2c.7.5 1.2 1.2 1.2 2v.3h4v-.3c0-.8.5-1.5 1.2-2A5.6 5.6 0 0 0 12 3.5Z"/><path d="M12 0.6v1.2M4.6 3.4l1 1M19.4 3.4l-1 1M2.2 9.5h1.4M20.4 9.5h1.4"/></svg>
			</button>
			<button class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
		</div>
	</div>
</header>
