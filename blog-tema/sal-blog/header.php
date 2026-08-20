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
			var t = localStorage.getItem('tema');
			if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro';
			if (t === 'claro') {
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
			<button class="tema-btn" type="button" aria-label="Alternar entre tema claro e escuro">
				<svg class="sol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>
				<svg class="lua" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>
			</button>
			<button class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
		</div>
	</div>
</header>
