<?php
// ─────────────────────────────────────────────────────────────────
// SAL — Artigo 2026 (single post no modelo do portal)
// Intercepta is_singular('post') ANTES do template Elementor single.
// Rollback = desativar este snippet.
// Newsletter: mecanismo Substack PRESERVADO (ids sal-news-inline/final,
// data-substack, submit abre marcelofreitas.substack.com/subscribe
// com email + UTMs — idêntico ao comportamento anterior).
// CSS prefixado sb- / sbp-.
// ─────────────────────────────────────────────────────────────────
add_action( 'template_redirect', function () {
	if ( ! is_singular( 'post' ) || post_password_required() ) return;

	$post = get_queried_object();

	$LOGO_ROXO   = 'https://www.salestrategias.com.br/wp-content/uploads/2025/11/logotipo-sal-estrategias-marketing-2.svg';
	$LOGO_BRANCO = 'https://www.salestrategias.com.br/wp-content/uploads/2025/11/logo-sal-branco.png';
	$WHATS       = 'https://wa.me/5551993380278';
	$DIAG        = 'https://www.salestrategias.com.br/agenda/';
	$SUBSTACK    = 'https://marcelofreitas.substack.com/subscribe';

	$EDITORIAS = [
		'trafego-pago' => [ 'id' => 15, 'nome' => 'Tráfego Pago' ],
		'seo-geo'      => [ 'id' => 13, 'nome' => 'SEO & GEO' ],
		'e-commerce'   => [ 'id' => 14, 'nome' => 'E-commerce' ],
		'varejo-local' => [ 'id' => 17, 'nome' => 'Varejo Local' ],
	];
	$ROTULOS = [ 15 => 'Tráfego Pago', 13 => 'SEO & GEO', 14 => 'E-commerce', 17 => 'Varejo Local', 29 => 'Estratégia' ];

	$blog_url = home_url( '/blog/' );
	$ed_url = function ( $slug ) use ( $blog_url ) {
		return esc_url( add_query_arg( 'editoria', $slug, $blog_url ) );
	};

	// rótulo + editoria do post
	$cats_do_post = wp_get_post_categories( $post->ID );
	$rotulo = 'Estratégia'; $ed_slug_post = '';
	foreach ( $cats_do_post as $cid ) {
		if ( isset( $ROTULOS[ $cid ] ) ) {
			$rotulo = $ROTULOS[ $cid ];
			foreach ( $EDITORIAS as $slug => $ed ) { if ( $ed['id'] === $cid ) { $ed_slug_post = $slug; break; } }
			break;
		}
	}

	// conteúdo processado (blocos do Rank Math, shortcodes, lazyload etc.)
	$conteudo = apply_filters( 'the_content', $post->post_content );

	// tempo de leitura
	$palavras = str_word_count( wp_strip_all_tags( $post->post_content ) );
	$minutos  = max( 1, (int) round( $palavras / 200 ) );

	// relacionados: mesma categoria, senão recentes
	$rel = get_posts( [ 'numberposts' => 3, 'category' => $cats_do_post ? $cats_do_post[0] : 0, 'post__not_in' => [ $post->ID ] ] );
	if ( count( $rel ) < 3 ) {
		$extras = get_posts( [ 'numberposts' => 6, 'post__not_in' => array_merge( [ $post->ID ], wp_list_pluck( $rel, 'ID' ) ) ] );
		$rel = array_slice( array_merge( $rel, $extras ), 0, 3 );
	}

	$img_destaque = get_the_post_thumbnail_url( $post, 'full' );
	$favicon_32  = function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 32 ) : '';
	$favicon_192 = function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 192 ) : '';

	?><!doctype html>
	<html lang="pt-BR">
	<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
	<?php if ( $favicon_32 ) : ?><link rel="icon" type="image/png" sizes="32x32" href="<?php echo esc_url( $favicon_32 ); ?>"><?php endif; ?>
	<?php if ( $favicon_192 ) : ?><link rel="icon" type="image/png" sizes="192x192" href="<?php echo esc_url( $favicon_192 ); ?>"><link rel="apple-touch-icon" href="<?php echo esc_url( $favicon_192 ); ?>"><?php endif; ?>
	<?php wp_head(); ?>
	<style>
	.sb-body{margin:0;padding:0;font-family:'Plus Jakarta Sans',sans-serif;color:#0A0A0F;background:#fff;-webkit-font-smoothing:antialiased}
	.sb-body *{box-sizing:border-box}
	.sb-body a{color:inherit;text-decoration:none}
	.sb-body img{max-width:100%;border:none}
	.sb-wrap{max-width:1240px;margin:0 auto;padding:0 32px}
	.sb-grain{display:inline-block;width:7px;height:7px;background:#2D1D7A;transform:rotate(45deg);flex:none}
	.sb-grain.sb-roxo{background:#7E30E1}.sb-grain.sb-neon{background:#F6FF74}
	.sb-eyebrow{font-family:'Inter',sans-serif;font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#2D1D7A}
	.sb-cat{color:#7E30E1}
	.sb-pill{display:inline-flex;align-items:center;gap:10px;background:#7E30E1;color:#fff !important;border-radius:40px;padding:18px 44px;font-weight:600;font-size:16px;transition:transform .15s ease,box-shadow .15s ease;cursor:pointer;border:none}
	.sb-pill:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(126,48,225,.28)}
	.sb-topbar{background:#0A0A0F;color:rgba(255,255,255,.85);font-family:'Inter',sans-serif;font-size:12.5px;letter-spacing:1px}
	.sb-topbar .sb-wrap{display:flex;justify-content:space-between;align-items:center;height:38px;gap:16px}
	.sb-topbar b{color:#fff;font-weight:600}
	.sb-topbar .sb-tag{display:flex;align-items:center;gap:10px}
	.sb-header{position:sticky;top:0;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);z-index:50;border-bottom:1px solid #E9E7E1}
	.sb-header .sb-wrap{display:flex;align-items:center;justify-content:space-between;height:78px;gap:24px}
	.sb-header img.sb-logo{width:148px;height:auto;display:block}
	.sb-nav{display:flex;gap:28px;font-size:15px;font-weight:600;color:#2D1D7A}
	.sb-nav a{padding:6px 0;border-bottom:2px solid transparent}
	.sb-nav a:hover{border-color:#7E30E1;color:#7E30E1}
	.sb-header-cta{background:#7E30E1;color:#fff !important;border-radius:40px;padding:13px 30px;font-weight:600;font-size:15px;white-space:nowrap}
	/* migalha */
	.sbp-crumb{border-bottom:1px solid #E9E7E1;background:#F4F7F7}
	.sbp-crumb .sb-wrap{display:flex;align-items:center;gap:12px;height:46px;font-family:'Inter',sans-serif;font-size:13px;color:#5A5A66;overflow:hidden;white-space:nowrap}
	.sbp-crumb a:hover{color:#7E30E1}
	.sbp-crumb .sb-grain{width:5px;height:5px}
	/* cabeçalho do artigo */
	.sbp-hero{max-width:860px;margin:0 auto;padding:56px 32px 8px;text-align:left}
	.sbp-hero .sb-eyebrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
	.sbp-hero h1{font-size:clamp(32px,4vw,52px);font-weight:800;line-height:1.1;letter-spacing:-1.2px;margin:18px 0 16px;color:#0A0A0F}
	.sbp-dek{font-size:19px;line-height:1.6;color:#5A5A66;margin:0 0 22px}
	.sbp-autor{display:flex;align-items:center;gap:12px;font-family:'Inter',sans-serif;font-size:14px;color:#5A5A66;padding-bottom:8px}
	.sbp-autor b{color:#0A0A0F;font-weight:600}
	.sbp-figura{max-width:1080px;margin:28px auto 0;padding:0 32px}
	.sbp-figura img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:24px;box-shadow:0 24px 50px rgba(10,10,15,.12);display:block}
	/* corpo do artigo */
	.sbp-content{max-width:760px;margin:0 auto;padding:44px 32px 8px;font-size:18px;line-height:1.75;color:#1C1C24}
	.sbp-content p{margin:0 0 24px}
	.sbp-content h2{font-size:29px;font-weight:800;letter-spacing:-.6px;line-height:1.25;margin:52px 0 20px;color:#0A0A0F;scroll-margin-top:110px}
	.sbp-content h3{font-size:21.5px;font-weight:700;line-height:1.3;margin:38px 0 16px;color:#0A0A0F;scroll-margin-top:110px}
	.sbp-content a{color:#7E30E1;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
	.sbp-content a:hover{color:#2D1D7A}
	.sbp-content ul,.sbp-content ol{margin:0 0 24px;padding-left:26px}
	.sbp-content li{margin-bottom:10px}
	.sbp-content strong{font-weight:700;color:#0A0A0F}
	.sbp-content table{width:100%;border-collapse:collapse;margin:8px 0 28px;font-size:15.5px;display:block;overflow-x:auto}
	.sbp-content table thead th{background:#0A0A0F;color:#fff;text-align:left;padding:12px 16px;font-weight:600;white-space:nowrap}
	.sbp-content table td{border:1px solid #E9E7E1;padding:12px 16px;vertical-align:top}
	.sbp-content table tbody tr:nth-child(even){background:#F8F6F2}
	.sbp-content blockquote{border-left:4px solid #7E30E1;background:#F8F6F2;margin:0 0 24px;padding:18px 24px;border-radius:0 14px 14px 0;font-style:normal}
	.sbp-content img{border-radius:16px;height:auto}
	.sbp-content figure{margin:0 0 24px}
	/* sumário (bloco TOC do Rank Math) */
	.sbp-content #rank-math-toc{background:#F8F6F2;border:1px solid #E9E7E1;border-left:5px solid #7E30E1;border-radius:0 18px 18px 0;padding:26px 30px;margin:0 0 34px;font-size:15.5px}
	.sbp-content #rank-math-toc h2{font-size:20px;margin:0 0 14px;scroll-margin-top:0}
	.sbp-content #rank-math-toc nav>ol{margin:0;padding-left:20px}
	.sbp-content #rank-math-toc ol ol{margin-top:8px}
	.sbp-content #rank-math-toc li{margin-bottom:8px}
	.sbp-content #rank-math-toc a{color:#2D1D7A;text-decoration:none;font-weight:500}
	.sbp-content #rank-math-toc a:hover{color:#7E30E1}
	/* newsletter: cards ORIGINAIS injetados via wp_footer pelo snippet antigo (CSS deles, não estilizar aqui) */
	/* CTA do template (o card roxo legado fica oculto — o JS antigo pode movê-lo, nunca aparece) */
	.sal-post-cta-wrap{display:none !important}
	.sbp-cta{max-width:760px;margin:14px auto 8px;background:#F8F6F2;border:1px solid #E9E7E1;border-radius:22px;padding:36px;text-align:center}
	.sbp-cta h2{font-size:26px;font-weight:800;letter-spacing:-.5px;margin:0 0 8px;color:#0A0A0F}
	.sbp-cta h2 em{font-style:normal;color:#7E30E1}
	.sbp-cta p{color:#5A5A66;font-size:15.5px;margin:0 0 22px}
	/* autor */
	.sbp-bio{max-width:760px;margin:34px auto 0;padding:26px 30px;border:1px solid #E9E7E1;border-radius:18px;display:flex;flex-direction:column;gap:8px}
	.sbp-bio .sb-eyebrow{font-size:11px}
	.sbp-bio p{margin:0;font-size:15px;line-height:1.6;color:#5A5A66}
	.sbp-bio b{color:#0A0A0F}
	.sbp-bio-links{display:flex;gap:18px;font-family:'Inter',sans-serif;font-size:13.5px;font-weight:600}
	.sbp-bio-links a{color:#7E30E1}
	/* relacionados */
	.sbp-rel{padding:64px 0 76px}
	.sb-sec-label{display:flex;align-items:center;gap:14px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;letter-spacing:4px;color:#2D1D7A;text-transform:uppercase;margin:0 0 34px}
	.sb-sec-label::after{content:"";height:1px;background:#E9E7E1;flex:1}
	.sb-grid-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
	.sb-card{border-radius:20px;overflow:hidden;background:#fff;border:1px solid #E9E7E1;transition:transform .15s ease,box-shadow .15s ease;display:flex;flex-direction:column}
	.sb-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(10,10,15,.1)}
	.sb-card figure{aspect-ratio:16/9;overflow:hidden;background:#F8F6F2;margin:0}
	.sb-card figure img{width:100%;height:100%;object-fit:cover;display:block}
	.sb-card-body{padding:20px 20px 22px;display:flex;flex-direction:column;gap:10px;flex:1}
	.sb-card-body .sb-eyebrow{font-size:10.5px;letter-spacing:2.5px}
	.sb-card-body h3{font-size:16.5px;font-weight:700;line-height:1.3;color:#0A0A0F;margin:0}
	.sb-card-body time{font-family:'Inter',sans-serif;font-size:12.5px;color:#5A5A66;margin-top:auto}
	/* footer oficial do site (v10), adaptado pro blog */
	.sbf{background:#0A0A0F;color:rgba(255,255,255,.7);padding:64px 32px 32px;border-top:1px solid rgba(255,255,255,.08)}
	.sbf-inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:48px;padding-bottom:48px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:32px}
	.sbf-brand{display:flex;flex-direction:column;gap:20px;align-items:flex-start}
	.sbf-brand img{height:52px;width:auto;margin-bottom:4px}
	.sbf-tag{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#F6FF74;font-weight:700}
	.sbf-brand p{font-size:14px;line-height:1.6;max-width:38ch;margin:0}
	.sbf-col h4{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#F6FF74;font-weight:700;margin:0 0 16px}
	.sbf-col ul{list-style:none;margin:0;padding:0}
	.sbf-col li{padding:6px 0;font-size:14px}
	.sbf-col a:hover{color:#F6FF74}
	.sbf-bottom{max-width:1240px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;font-family:'Inter',sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5);flex-wrap:wrap;gap:16px}
	.sbf-social{display:flex;gap:14px;align-items:center}
	.sbf-social a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);transition:background .2s,color .2s,transform .2s}
	.sbf-social a:hover{background:#F6FF74;color:#0A0A0F;transform:translateY(-2px)}
	@media(max-width:1020px){
		.sb-nav{display:none}
		.sb-grid-cards{grid-template-columns:1fr}
		.sbf-inner{grid-template-columns:1fr 1fr}
		.sbf-brand{grid-column:1/-1}
	}
	@media(max-width:620px){
		.sb-wrap{padding:0 20px}
		.sbp-hero,.sbp-content,.sbp-figura{padding-left:20px;padding-right:20px}
		.sb-topbar .sb-data{display:none}
	}
	</style>
	</head>
	<body class="sb-body">

	<div class="sb-topbar">
		<div class="sb-wrap">
			<span class="sb-data"><?php echo esc_html( date_i18n( 'l, j \d\e F \d\e Y' ) ); ?></span>
			<span class="sb-tag"><span class="sb-grain sb-neon"></span><b>Marketing na Medida Certa</b><span class="sb-grain sb-neon"></span></span>
			<a href="<?php echo esc_url( $WHATS ); ?>"><b>WhatsApp</b> +55 51 99338-0278</a>
		</div>
	</div>

	<div class="sb-header">
		<div class="sb-wrap">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><img class="sb-logo" src="<?php echo esc_url( $LOGO_ROXO ); ?>" alt="SAL Estratégias de Marketing"></a>
			<nav class="sb-nav">
				<?php foreach ( $EDITORIAS as $slug => $ed ) : ?>
					<a href="<?php echo $ed_url( $slug ); ?>"><?php echo esc_html( $ed['nome'] ); ?></a>
				<?php endforeach; ?>
			</nav>
			<a class="sb-header-cta" href="<?php echo esc_url( $DIAG ); ?>">Contrate a SAL</a>
		</div>
	</div>

	<div class="sbp-crumb">
		<div class="sb-wrap">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>">Home</a><span class="sb-grain"></span>
			<a href="<?php echo esc_url( $blog_url ); ?>">Blog</a><span class="sb-grain"></span>
			<?php if ( $ed_slug_post ) : ?><a href="<?php echo $ed_url( $ed_slug_post ); ?>"><?php echo esc_html( $rotulo ); ?></a><?php else : ?><span><?php echo esc_html( $rotulo ); ?></span><?php endif; ?>
		</div>
	</div>

	<article>
		<header class="sbp-hero">
			<div class="sb-eyebrow"><span class="sb-cat"><?php echo esc_html( $rotulo ); ?></span><span class="sb-grain sb-roxo"></span><span><?php echo esc_html( date_i18n( 'j \d\e F \d\e Y', strtotime( $post->post_date ) ) ); ?></span><span class="sb-grain sb-roxo"></span><span><?php echo (int) $minutos; ?> min de leitura</span></div>
			<h1><?php echo esc_html( get_the_title( $post ) ); ?></h1>
			<?php $dek = wp_strip_all_tags( get_the_excerpt( $post ) ); if ( $dek ) : ?><p class="sbp-dek"><?php echo esc_html( $dek ); ?></p><?php endif; ?>
			<div class="sbp-autor"><b>Marcelo Freitas</b><span class="sb-grain" style="width:5px;height:5px"></span><span>Fundador da SAL · marketing desde 2014</span></div>
		</header>

		<?php if ( $img_destaque ) : ?>
		<div class="sbp-figura"><img src="<?php echo esc_url( $img_destaque ); ?>" alt="<?php echo esc_attr( get_the_title( $post ) ); ?>"></div>
		<?php endif; ?>

		<?php
		// .sal-sp-content: seletor que o snippet antigo de newsletter procura — os cards
		// originais (injetados via wp_footer por outro snippet) se posicionam sozinhos:
		// inline no meio dos parágrafos e final antes do #sal-cta-after-post.
		?>
		<div class="sbp-content sal-sp-content" id="sbp-content">
			<?php echo $conteudo; // já passou por the_content (esc feito pelo WP no save) ?>
		</div>
	</article>

	<?php
	// CTA do template (aprovado pelo Marcelo). SEM id sal-cta-after-post: esse id pertence
	// ao card roxo legado (injetado via wp_footer), que fica oculto via CSS .sal-post-cta-wrap.
	?>
	<div class="sbp-cta">
		<h2>Quer marketing <em>na medida certa</em> para a sua loja?</h2>
		<p>Diagnóstico sem custo · 30 minutos, online · direto com quem faz</p>
		<a class="sb-pill" href="<?php echo esc_url( $DIAG ); ?>">Agendar diagnóstico →</a>
	</div>

	<div class="sbp-bio sb-wrap" style="max-width:760px">
		<span class="sb-eyebrow">Escrito por</span>
		<p><b>Marcelo Freitas</b> · Fundador da SAL Estratégias de Marketing. Trabalha com marketing desde 2014, com foco em tráfego pago, SEO e crescimento de lojas e negócios locais. Sede em Porto Alegre, atendimento no Brasil todo.</p>
		<div class="sbp-bio-links">
			<a href="https://linkedin.com/in/mcfreitas" rel="noopener" target="_blank">LinkedIn</a>
			<a href="https://instagram.com/salestrategias" rel="noopener" target="_blank">Instagram</a>
			<a href="https://marcelofreitas.substack.com/" rel="noopener" target="_blank">Newsletter</a>
		</div>
	</div>

	<?php if ( $rel ) : ?>
	<section class="sbp-rel">
		<div class="sb-wrap">
			<h2 class="sb-sec-label">Continue lendo</h2>
			<div class="sb-grid-cards">
				<?php foreach ( $rel as $r ) :
					$rimg = get_the_post_thumbnail_url( $r, 'large' );
					$rrot = 'Estratégia';
					foreach ( wp_get_post_categories( $r->ID ) as $cid ) { if ( isset( $ROTULOS[ $cid ] ) ) { $rrot = $ROTULOS[ $cid ]; break; } }
				?>
				<a class="sb-card" href="<?php echo esc_url( get_permalink( $r ) ); ?>">
					<figure><?php if ( $rimg ) : ?><img src="<?php echo esc_url( $rimg ); ?>" alt="<?php echo esc_attr( get_the_title( $r ) ); ?>" loading="lazy"><?php endif; ?></figure>
					<div class="sb-card-body">
						<span class="sb-eyebrow sb-cat"><?php echo esc_html( $rrot ); ?></span>
						<h3><?php echo esc_html( get_the_title( $r ) ); ?></h3>
						<time><?php echo esc_html( date_i18n( 'j \d\e F \d\e Y', strtotime( $r->post_date ) ) ); ?></time>
					</div>
				</a>
				<?php endforeach; ?>
			</div>
		</div>
	</section>
	<?php endif; ?>

	<footer class="sbf">
		<div class="sbf-inner">
			<div class="sbf-brand">
				<img src="<?php echo esc_url( $LOGO_ROXO ); ?>" alt="SAL Estratégias de Marketing" width="100" height="24">
				<div class="sbf-tag">Marketing na Medida Certa</div>
				<p>Assessoria de marketing pra varejo e e-commerce, com método. Sede em Porto Alegre, atendemos o Brasil todo.</p>
			</div>
			<div class="sbf-col">
				<h4>Serviços</h4>
				<ul>
					<li><a href="/servicos/agencia-de-seo/">SEO + GEO</a></li>
					<li><a href="/servicos/gestao-de-trafego-pago/">Tráfego Pago</a></li>
					<li><a href="/servicos/agencia-de-producao-de-conteudo/">Conteúdo</a></li>
					<li><a href="/servicos/criacao-de-sites/">Sites</a></li>
					<li><a href="/servicos/consultoria/">Consultoria</a></li>
					<li><a href="/servicos/assessoria-de-google-meu-negocio/">Google Meu Negócio</a></li>
				</ul>
			</div>
			<div class="sbf-col">
				<h4>Navegar</h4>
				<ul>
					<li><a href="/quem-somos/">Sobre</a></li>
					<li><a href="/blog/">Blog</a></li>
					<li><a href="/diagnostico/">Diagnóstico</a></li>
					<li><a href="/#cases">Cases</a></li>
				</ul>
			</div>
			<div class="sbf-col">
				<h4>Editorias</h4>
				<ul>
					<?php foreach ( $EDITORIAS as $slug => $ed ) : ?>
						<li><a href="<?php echo $ed_url( $slug ); ?>"><?php echo esc_html( $ed['nome'] ); ?></a></li>
					<?php endforeach; ?>
				</ul>
			</div>
			<div class="sbf-col">
				<h4>Contato</h4>
				<ul>
					<li><a href="<?php echo esc_url( $WHATS ); ?>" target="_blank" rel="noopener">WhatsApp</a></li>
					<li><a href="mailto:contato@salestrategias.com.br">contato@salestrategias.com.br</a></li>
					<li>Porto Alegre · RS</li>
					<li><a href="/politica-de-privacidade/">Privacidade</a> · <a href="/termos-de-uso/">Termos</a></li>
				</ul>
			</div>
		</div>
		<div class="sbf-bottom">
			<span>© <?php echo esc_html( date_i18n( 'Y' ) ); ?> SAL ESTRATÉGIAS DE MARKETING LTDA · Marketing na Medida Certa</span>
			<div class="sbf-social">
				<a href="https://instagram.com/salestrategias" target="_blank" rel="noopener" aria-label="Instagram da SAL">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.849 0 3.205-.012 3.585-.07 4.85-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.265.058-1.645.07-4.85.07-3.204 0-3.584-.012-4.849-.07-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.747 2.163 15.368 2.163 12s.012-3.584.07-4.849c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zm0 1.838c-3.15 0-3.523.011-4.766.068-1.06.048-1.633.224-2.014.372-.506.197-.867.432-1.247.812-.38.38-.615.741-.812 1.247-.148.381-.324.954-.372 2.014-.057 1.243-.068 1.616-.068 4.766s.011 3.523.068 4.766c.048 1.06.224 1.633.372 2.014.197.506.432.867.812 1.247.38.38.741.615 1.247.812.381.148.954.324 2.014.372 1.243.057 1.616.068 4.766.068s3.523-.011 4.766-.068c1.06-.048 1.633-.224 2.014-.372.506-.197.867-.432 1.247-.812.38-.38.615-.741.812-1.247.148-.381.324-.954.372-2.014.057-1.243.068-1.616.068-4.766s-.011-3.523-.068-4.766c-.048-1.06-.224-1.633-.372-2.014-.197-.506-.432-.867-.812-1.247-.38-.38-.741-.615-1.247-.812-.381-.148-.954-.324-2.014-.372C15.523 4.012 15.15 4.001 12 4.001zM12 6.865c-2.838 0-5.135 2.297-5.135 5.135 0 2.838 2.297 5.135 5.135 5.135 2.838 0 5.135-2.297 5.135-5.135 0-2.838-2.297-5.135-5.135-5.135zm0 8.469c-1.842 0-3.334-1.493-3.334-3.334 0-1.842 1.492-3.334 3.334-3.334s3.334 1.492 3.334 3.334c0 1.841-1.492 3.334-3.334 3.334zm6.538-8.671c0 .662-.537 1.2-1.2 1.2-.662 0-1.2-.538-1.2-1.2 0-.663.538-1.2 1.2-1.2.663 0 1.2.537 1.2 1.2z"/></svg>
				</a>
				<a href="https://br.linkedin.com/company/salagenciademarketing" target="_blank" rel="noopener" aria-label="LinkedIn da SAL">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
				</a>
			</div>
		</div>
	</footer>

	<?php // Newsletter: posicionamento e submit ficam por conta do snippet original (wp_footer) ?>

	<?php
	if ( function_exists( 'sal_lead_modal_render' ) ) { sal_lead_modal_render(); }
	wp_footer();
	?>
	</body>
	</html><?php
	exit;
}, 1 );
