<?php
// ─────────────────────────────────────────────────────────────────
// SAL — Blog Portal 2026 ("portal de notícias do varejo")
// Intercepta o /blog/ (posts page) ANTES do template Elementor
// (elementor-location-archive 1762 fica dormente; rollback =
// desativar este snippet). Padrão idêntico à home v10.
// Views: portal (default) e editoria (/blog/?editoria=slug —
// necessário porque /category/* redireciona pra home).
// CSS 100% prefixado .sb- (tema hello-biz continua carregando via wp_head).
// ─────────────────────────────────────────────────────────────────
add_action( 'template_redirect', function () {
	if ( ! is_home() && ! is_page( 'blog' ) ) return;

	// ─── Config ─────────────────────────────────────────────────
	$LOGO_ROXO   = 'https://www.salestrategias.com.br/wp-content/uploads/2025/11/logotipo-sal-estrategias-marketing-2.svg';
	$LOGO_BRANCO = 'https://www.salestrategias.com.br/wp-content/uploads/2025/11/logo-sal-branco.png';
	$WHATS       = 'https://wa.me/5551993380278';
	$DIAG        = 'https://salestrategias.com.br/diagnostico/';

	$EDITORIAS = [
		'trafego-pago' => [ 'id' => 15, 'nome' => 'Tráfego Pago' ],
		'seo-geo'      => [ 'id' => 13, 'nome' => 'SEO & GEO' ],
		'e-commerce'   => [ 'id' => 14, 'nome' => 'E-commerce' ],
		'varejo-local' => [ 'id' => 17, 'nome' => 'Varejo Local' ],
	];
	$ROTULOS = [ 15 => 'Tráfego Pago', 13 => 'SEO & GEO', 14 => 'E-commerce', 17 => 'Varejo Local', 29 => 'Estratégia' ];

	$GUIAS_SLUGS = [
		'roas-alto-mas-sem-lucro',
		'loja-virtual-nao-vende-o-que-fazer',
		'como-estruturar-marketing-de-uma-loja',
		'cac-e-ltv-como-calcular-metricas-negocio',
	];

	$ed_param = isset( $_GET['editoria'] ) ? sanitize_title( wp_unslash( $_GET['editoria'] ) ) : '';
	$view_editoria = ( $ed_param && isset( $EDITORIAS[ $ed_param ] ) ) ? $EDITORIAS[ $ed_param ] : null;

	// ─── Helpers ────────────────────────────────────────────────
	$rotulo = function ( $post ) use ( $ROTULOS ) {
		foreach ( wp_get_post_categories( $post->ID ) as $cid ) {
			if ( isset( $ROTULOS[ $cid ] ) ) return $ROTULOS[ $cid ];
		}
		return 'Estratégia';
	};
	$thumb = function ( $post, $tam = 'large' ) {
		$u = get_the_post_thumbnail_url( $post, $tam );
		return $u ? $u : '';
	};
	$resumo = function ( $post, $palavras = 26 ) {
		return esc_html( wp_trim_words( wp_strip_all_tags( get_the_excerpt( $post ) ), $palavras, '…' ) );
	};
	$dataf = function ( $post ) {
		return esc_html( date_i18n( 'j \d\e F \d\e Y', strtotime( $post->post_date ) ) );
	};
	$ed_url = function ( $slug ) {
		return esc_url( add_query_arg( 'editoria', $slug, get_permalink( get_option( 'page_for_posts' ) ?: null ) ?: home_url( '/blog/' ) ) );
	};
	$card = function ( $post ) use ( $rotulo, $thumb, $dataf ) {
		$img = $thumb( $post );
		?>
		<a class="sb-card" href="<?php echo esc_url( get_permalink( $post ) ); ?>">
			<figure><?php if ( $img ) : ?><img src="<?php echo esc_url( $img ); ?>" alt="<?php echo esc_attr( get_the_title( $post ) ); ?>" loading="lazy"><?php endif; ?></figure>
			<div class="sb-card-body">
				<span class="sb-eyebrow sb-cat"><?php echo esc_html( $rotulo( $post ) ); ?></span>
				<h3><?php echo esc_html( get_the_title( $post ) ); ?></h3>
				<time><?php echo $dataf( $post ); ?></time>
			</div>
		</a>
		<?php
	};

	// ─── Dados ──────────────────────────────────────────────────
	if ( $view_editoria ) {
		$posts_ed = get_posts( [ 'numberposts' => 50, 'category' => $view_editoria['id'] ] );
	} else {
		$recentes = get_posts( [ 'numberposts' => 9 ] );
		$manchete = array_shift( $recentes ); // 1º
		$ultimas  = $recentes;                // próximos 8
		$por_ed   = [];
		foreach ( $EDITORIAS as $slug => $ed ) {
			$por_ed[ $slug ] = get_posts( [ 'numberposts' => 4, 'category' => $ed['id'] ] );
		}
		$guias = [];
		foreach ( $GUIAS_SLUGS as $gs ) {
			$g = get_posts( [ 'name' => $gs, 'numberposts' => 1 ] );
			if ( $g ) $guias[] = $g[0];
		}
		$mais_lidos = array_slice( array_merge( [ $manchete ], $ultimas ), 0, 5 );
	}

	$favicon_32  = function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 32 ) : '';
	$favicon_192 = function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 192 ) : '';

	// ─── Render ─────────────────────────────────────────────────
	?><!doctype html>
	<html lang="pt-BR">
	<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php if ( $view_editoria ) : ?><meta name="robots" content="noindex,follow"><?php endif; ?>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=Glook&display=swap" rel="stylesheet">
	<?php if ( $favicon_32 ) : ?><link rel="icon" type="image/png" sizes="32x32" href="<?php echo esc_url( $favicon_32 ); ?>"><?php endif; ?>
	<?php if ( $favicon_192 ) : ?><link rel="icon" type="image/png" sizes="192x192" href="<?php echo esc_url( $favicon_192 ); ?>"><link rel="apple-touch-icon" href="<?php echo esc_url( $favicon_192 ); ?>"><?php endif; ?>
	<?php wp_head(); ?>
	<style>
	.sb-body{margin:0;padding:0;font-family:'Plus Jakarta Sans',sans-serif;color:#0A0A0F;background:#fff;-webkit-font-smoothing:antialiased}
	.sb-body *{box-sizing:border-box}
	.sb-body a{color:inherit;text-decoration:none}
	.sb-body img{max-width:100%;display:block;border:none}
	.sb-body h1,.sb-body h2,.sb-body h3,.sb-body h4,.sb-body p,.sb-body ul,.sb-body ol,.sb-body figure{margin:0;padding:0}
	.sb-body ul,.sb-body ol{list-style:none}
	.sb-wrap{max-width:1240px;margin:0 auto;padding:0 32px}
	.sb-eyebrow{font-family:'Inter',sans-serif;font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#2D1D7A}
	.sb-cat{color:#7E30E1}
	.sb-grain{display:inline-block;width:7px;height:7px;background:#2D1D7A;transform:rotate(45deg);flex:none}
	.sb-grain.sb-roxo{background:#7E30E1}.sb-grain.sb-neon{background:#F6FF74}
	.sb-sec-label{display:flex;align-items:center;gap:14px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;letter-spacing:4px;color:#2D1D7A;text-transform:uppercase;margin-bottom:34px}
	.sb-sec-label::after{content:"";height:1px;background:#E9E7E1;flex:1}
	.sb-pill{display:inline-flex;align-items:center;gap:10px;background:#7E30E1;color:#fff !important;border-radius:40px;padding:18px 44px;font-weight:600;font-size:16px;transition:transform .15s ease,box-shadow .15s ease;cursor:pointer;border:none}
	.sb-pill:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(126,48,225,.28);color:#fff}
	.sb-pill.sb-ghost{background:transparent;color:#2D1D7A !important;border:2px solid #2D1D7A}
	.sb-topbar{background:#0A0A0F;color:rgba(255,255,255,.85);font-family:'Inter',sans-serif;font-size:12.5px;letter-spacing:1px}
	.sb-topbar .sb-wrap{display:flex;justify-content:space-between;align-items:center;height:38px;gap:16px}
	.sb-topbar b{color:#fff;font-weight:600}
	.sb-topbar .sb-tag{display:flex;align-items:center;gap:10px}
	.sb-header{position:sticky;top:0;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);z-index:50;border-bottom:1px solid #E9E7E1}
	.sb-header .sb-wrap{display:flex;align-items:center;justify-content:space-between;height:78px;gap:24px}
	.sb-header img.sb-logo{width:148px;height:auto}
	.sb-nav{display:flex;gap:28px;font-size:15px;font-weight:600;color:#2D1D7A}
	.sb-nav a{padding:6px 0;border-bottom:2px solid transparent}
	.sb-nav a:hover{border-color:#7E30E1;color:#7E30E1}
	.sb-header-cta{background:#7E30E1;color:#fff !important;border-radius:40px;padding:13px 30px;font-weight:600;font-size:15px;white-space:nowrap}
	.sb-hero{padding:64px 0 56px}
	.sb-hero .sb-wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:64px;align-items:center}
	.sb-hero .sb-eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:22px}
	.sb-hero h1{font-size:clamp(38px,4.6vw,60px);font-weight:800;line-height:1.06;letter-spacing:-1.5px;margin-bottom:22px;color:#0A0A0F}
	.sb-hero p.sb-dek{font-size:19px;line-height:1.55;color:#5A5A66;max-width:56ch;margin-bottom:26px}
	.sb-hero .sb-meta{font-family:'Inter',sans-serif;font-size:14px;color:#5A5A66;display:flex;align-items:center;gap:10px;margin-bottom:34px}
	.sb-hero .sb-cta-row{display:flex;gap:16px;flex-wrap:wrap}
	.sb-hero figure{position:relative;border-radius:24px;overflow:hidden;aspect-ratio:16/11;box-shadow:0 30px 60px rgba(10,10,15,.14)}
	.sb-hero figure img{width:100%;height:100%;object-fit:cover}
	.sb-hero .sb-badge{position:absolute;top:18px;left:18px;background:#F6FF74;color:#0A0A0F;font-family:'Inter',sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;padding:7px 14px;border-radius:40px;z-index:2}
	.sb-ticker{background:#F4F7F7;border-top:1px solid #E9E7E1;border-bottom:1px solid #E9E7E1}
	.sb-ticker .sb-wrap{display:flex;align-items:center;gap:22px;height:52px;overflow:hidden}
	.sb-ticker .sb-lbl{font-family:'Inter',sans-serif;font-size:11px;font-weight:600;letter-spacing:3px;color:#7E30E1;white-space:nowrap;display:flex;gap:9px;align-items:center}
	.sb-ticker ul{display:flex;gap:34px;white-space:nowrap;font-size:14px;font-weight:500;color:#2D1D7A;overflow:hidden}
	.sb-ticker li{display:flex;align-items:center;gap:12px}
	.sb-ticker li .sb-grain{width:5px;height:5px}
	.sb-ultimas{padding:72px 0}
	.sb-grid-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:26px}
	.sb-card{border-radius:20px;overflow:hidden;background:#fff;border:1px solid #E9E7E1;transition:transform .15s ease,box-shadow .15s ease;display:flex;flex-direction:column}
	.sb-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(10,10,15,.1)}
	.sb-card figure{aspect-ratio:16/9;overflow:hidden;background:#F8F6F2}
	.sb-card figure img{width:100%;height:100%;object-fit:cover}
	.sb-card-body{padding:20px 20px 22px;display:flex;flex-direction:column;gap:10px;flex:1}
	.sb-card-body .sb-eyebrow{font-size:10.5px;letter-spacing:2.5px}
	.sb-card-body h3{font-size:16.5px;font-weight:700;line-height:1.3;color:#0A0A0F}
	.sb-card-body time{font-family:'Inter',sans-serif;font-size:12.5px;color:#5A5A66;margin-top:auto}
	.sb-editorias{padding:24px 0 40px}
	.sb-editoria{padding:46px 0;border-top:1px solid #E9E7E1}
	.sb-editoria:nth-of-type(even){background:#F8F6F2}
	.sb-ed-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:28px}
	.sb-ed-head h2{font-size:30px;font-weight:800;letter-spacing:-.5px;display:flex;align-items:center;gap:16px;color:#0A0A0F}
	.sb-ed-head h2 .sb-grain{width:9px;height:9px}
	.sb-ed-head a{font-family:'Inter',sans-serif;font-size:13.5px;font-weight:600;color:#7E30E1}
	.sb-ed-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:44px;align-items:center}
	.sb-ed-destaque{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center}
	.sb-ed-destaque figure{border-radius:18px;overflow:hidden;aspect-ratio:4/3;background:#F4F7F7}
	.sb-ed-destaque figure img{width:100%;height:100%;object-fit:cover}
	.sb-ed-destaque h3{font-size:21px;font-weight:800;line-height:1.25;margin:10px 0;color:#0A0A0F}
	.sb-ed-destaque p{font-size:14.5px;line-height:1.55;color:#5A5A66}
	.sb-ed-lista{display:flex;flex-direction:column}
	.sb-ed-lista li{display:flex;gap:18px;padding:16px 0;border-bottom:1px solid #E9E7E1;align-items:baseline}
	.sb-ed-lista li:last-child{border-bottom:none}
	.sb-ed-lista .sb-num{font-family:'Glook',cursive;font-size:26px;color:#7E30E1;min-width:34px}
	.sb-ed-lista h4{font-size:16.5px;font-weight:700;line-height:1.35;color:#0A0A0F}
	.sb-ed-lista h4:hover{color:#7E30E1}
	.sb-guias{background:#0A0A0F;color:#fff;padding:78px 0}
	.sb-guias .sb-sec-label{color:rgba(255,255,255,.75)}
	.sb-guias .sb-sec-label::after{background:rgba(255,255,255,.14)}
	.sb-guias h2.sb-tit{font-size:clamp(30px,3.4vw,44px);font-weight:800;letter-spacing:-1px;margin-bottom:8px;color:#fff}
	.sb-guias p.sb-sub{color:rgba(255,255,255,.65);font-size:17px;margin-bottom:44px;max-width:60ch}
	.sb-guias .sb-lista{display:grid;grid-template-columns:repeat(2,1fr);gap:0 60px}
	.sb-guias .sb-lista li{display:flex;gap:24px;align-items:baseline;padding:24px 0;border-bottom:1px solid rgba(255,255,255,.12)}
	.sb-guias .sb-num{font-family:'Glook',cursive;font-size:44px;color:#A76BF2;min-width:64px}
	.sb-guias h3{font-size:19px;font-weight:700;line-height:1.35;color:#fff}
	.sb-guias h3:hover{color:#A76BF2}
	.sb-guias .sb-dot{display:inline-block;width:6px;height:6px;background:#F6FF74;transform:rotate(45deg);margin-left:10px}
	.sb-diag{background:#F8F6F2;padding:84px 0;text-align:center}
	.sb-diag h2{font-size:clamp(30px,3.8vw,48px);font-weight:800;letter-spacing:-1px;max-width:22ch;margin:0 auto 14px;color:#0A0A0F}
	.sb-diag h2 em{font-style:normal;color:#7E30E1}
	.sb-diag p{color:#5A5A66;font-size:17px;margin-bottom:34px}
	.sb-diag .sb-grains{display:flex;justify-content:center;gap:16px;margin-bottom:30px}
	.sb-rc{padding:76px 0}
	.sb-rc-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:70px}
	.sb-maislidos li{display:flex;gap:22px;align-items:baseline;padding:17px 0;border-bottom:1px solid #E9E7E1}
	.sb-maislidos .sb-num{font-family:'Glook',cursive;font-size:38px;color:#7E30E1;min-width:50px}
	.sb-maislidos h4{font-size:17.5px;font-weight:700;line-height:1.35;color:#0A0A0F}
	.sb-news{background:#F4F7F7;border-radius:24px;padding:44px;height:fit-content}
	.sb-news h3{font-size:24px;font-weight:800;margin-bottom:10px;color:#0A0A0F}
	.sb-news p{font-size:15px;color:#5A5A66;line-height:1.55;margin-bottom:24px}
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
	.sb-ed-hero{padding:64px 0 20px}
	.sb-ed-hero h1{font-size:clamp(34px,4vw,52px);font-weight:800;letter-spacing:-1px;color:#0A0A0F;margin:14px 0 10px}
	.sb-ed-hero p{color:#5A5A66;font-size:17px}
	.sb-voltar{font-family:'Inter',sans-serif;font-size:13.5px;font-weight:600;color:#7E30E1}
	@media(max-width:1020px){
		.sb-hero .sb-wrap,.sb-ed-grid,.sb-rc-grid{grid-template-columns:1fr}
		.sb-grid-cards{grid-template-columns:repeat(2,1fr)}
		.sb-guias .sb-lista{grid-template-columns:1fr}
		.sb-nav{display:none}
		.sbf-inner{grid-template-columns:1fr 1fr}
		.sbf-brand{grid-column:1/-1}
	}
	@media(max-width:620px){
		.sb-grid-cards{grid-template-columns:1fr}
		.sb-ed-destaque{grid-template-columns:1fr}
		.sb-wrap{padding:0 20px}
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

	<?php if ( $view_editoria ) : ?>

	<section class="sb-ed-hero">
		<div class="sb-wrap">
			<a class="sb-voltar" href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">← Voltar ao portal</a>
			<div class="sb-eyebrow" style="margin-top:26px;display:flex;align-items:center;gap:12px"><span>Editoria</span><span class="sb-grain sb-roxo"></span><span class="sb-cat"><?php echo esc_html( $view_editoria['nome'] ); ?></span></div>
			<h1><?php echo esc_html( $view_editoria['nome'] ); ?></h1>
			<p><?php echo count( $posts_ed ); ?> artigo<?php echo count( $posts_ed ) === 1 ? '' : 's'; ?> publicados</p>
		</div>
	</section>
	<section class="sb-ultimas">
		<div class="sb-wrap">
			<div class="sb-grid-cards">
				<?php foreach ( $posts_ed as $p ) { $card( $p ); } ?>
			</div>
		</div>
	</section>

	<?php else : ?>

	<?php if ( $manchete ) : $mimg = $thumb( $manchete, 'full' ); ?>
	<section class="sb-hero">
		<div class="sb-wrap">
			<div>
				<div class="sb-eyebrow"><span>01 · Manchete</span><span class="sb-grain sb-roxo"></span><span class="sb-cat"><?php echo esc_html( $rotulo( $manchete ) ); ?></span></div>
				<h1><?php echo esc_html( get_the_title( $manchete ) ); ?></h1>
				<p class="sb-dek"><?php echo $resumo( $manchete, 34 ); ?></p>
				<div class="sb-meta">Marcelo Freitas <span class="sb-grain" style="width:5px;height:5px"></span> <?php echo $dataf( $manchete ); ?></div>
				<div class="sb-cta-row">
					<a class="sb-pill" href="<?php echo esc_url( get_permalink( $manchete ) ); ?>">Ler agora →</a>
					<a class="sb-pill sb-ghost" href="#sb-ultimas">Todas as últimas</a>
				</div>
			</div>
			<figure><span class="sb-badge">EM DESTAQUE</span><?php if ( $mimg ) : ?><img src="<?php echo esc_url( $mimg ); ?>" alt="<?php echo esc_attr( get_the_title( $manchete ) ); ?>"><?php endif; ?></figure>
		</div>
	</section>
	<?php endif; ?>

	<div class="sb-ticker">
		<div class="sb-wrap">
			<span class="sb-lbl"><span class="sb-grain sb-roxo"></span> AGORA NO VAREJO</span>
			<ul>
				<?php foreach ( array_slice( $ultimas, 0, 3 ) as $p ) : ?>
					<li><span class="sb-grain sb-roxo"></span><a href="<?php echo esc_url( get_permalink( $p ) ); ?>"><?php echo esc_html( get_the_title( $p ) ); ?></a></li>
				<?php endforeach; ?>
			</ul>
		</div>
	</div>

	<section class="sb-ultimas" id="sb-ultimas">
		<div class="sb-wrap">
			<div class="sb-sec-label">02 · Últimas</div>
			<div class="sb-grid-cards">
				<?php foreach ( $ultimas as $p ) { $card( $p ); } ?>
			</div>
		</div>
	</section>

	<section class="sb-editorias">
		<div class="sb-wrap"><div class="sb-sec-label">03 · Editorias</div></div>
		<?php foreach ( $EDITORIAS as $slug => $ed ) :
			$lote = $por_ed[ $slug ];
			if ( ! $lote ) continue;
			$top    = array_shift( $lote );
			$timg   = $thumb( $top );
		?>
		<div class="sb-editoria">
			<div class="sb-wrap">
				<div class="sb-ed-head">
					<h2><span class="sb-grain sb-roxo"></span><?php echo esc_html( $ed['nome'] ); ?></h2>
					<a href="<?php echo $ed_url( $slug ); ?>">Ver editoria →</a>
				</div>
				<div class="sb-ed-grid">
					<a class="sb-ed-destaque" href="<?php echo esc_url( get_permalink( $top ) ); ?>">
						<figure><?php if ( $timg ) : ?><img src="<?php echo esc_url( $timg ); ?>" alt="<?php echo esc_attr( get_the_title( $top ) ); ?>" loading="lazy"><?php endif; ?></figure>
						<div>
							<span class="sb-eyebrow sb-cat">Destaque</span>
							<h3><?php echo esc_html( get_the_title( $top ) ); ?></h3>
							<p><?php echo $resumo( $top, 20 ); ?></p>
						</div>
					</a>
					<ul class="sb-ed-lista">
						<?php $i = 2; foreach ( array_slice( $lote, 0, 3 ) as $p ) : ?>
						<li><span class="sb-num"><?php echo str_pad( $i++, 2, '0', STR_PAD_LEFT ); ?></span>
							<a href="<?php echo esc_url( get_permalink( $p ) ); ?>"><h4><?php echo esc_html( get_the_title( $p ) ); ?></h4></a></li>
						<?php endforeach; ?>
					</ul>
				</div>
			</div>
		</div>
		<?php endforeach; ?>
	</section>

	<?php if ( $guias ) : ?>
	<section class="sb-guias">
		<div class="sb-wrap">
			<div class="sb-sec-label">04 · Guias essenciais</div>
			<h2 class="sb-tit">Comece por aqui.</h2>
			<p class="sb-sub">Os artigos de fundação: a conta que protege a sua margem, o diagnóstico da loja que não vende e as bases de tráfego e SEO.</p>
			<ul class="sb-lista">
				<?php $i = 1; foreach ( $guias as $g ) : ?>
				<li><span class="sb-num"><?php echo str_pad( $i++, 2, '0', STR_PAD_LEFT ); ?></span>
					<a href="<?php echo esc_url( get_permalink( $g ) ); ?>"><h3><?php echo esc_html( get_the_title( $g ) ); ?><span class="sb-dot"></span></h3></a></li>
				<?php endforeach; ?>
			</ul>
		</div>
	</section>
	<?php endif; ?>

	<section class="sb-diag">
		<div class="sb-wrap">
			<div class="sb-grains"><span class="sb-grain sb-roxo"></span><span class="sb-grain"></span><span class="sb-grain sb-roxo"></span></div>
			<h2>Sua loja merece marketing <em>na medida certa</em>.</h2>
			<p>Diagnóstico gratuito · 15 minutos · direto com quem faz</p>
			<a class="sb-pill" href="<?php echo esc_url( $DIAG ); ?>">Fazer diagnóstico gratuito →</a>
		</div>
	</section>

	<section class="sb-rc">
		<div class="sb-wrap sb-rc-grid">
			<div class="sb-maislidos">
				<div class="sb-sec-label">05 · Mais lidos</div>
				<ol>
					<?php $i = 1; foreach ( $mais_lidos as $p ) : ?>
					<li><span class="sb-num"><?php echo $i++; ?></span><a href="<?php echo esc_url( get_permalink( $p ) ); ?>"><h4><?php echo esc_html( get_the_title( $p ) ); ?></h4></a></li>
					<?php endforeach; ?>
				</ol>
			</div>
			<div class="sb-news">
				<h3>O varejo muda toda semana.<br>A gente resume pra você.</h3>
				<p>Receba o essencial de tráfego, SEO e e-commerce, na medida certa. Sem spam, sem enrolação.</p>
				<a class="sb-pill js-sal-lead-cta" data-sal-lead href="<?php echo esc_url( $WHATS ); ?>">Quero receber →</a>
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

	<?php
	if ( function_exists( 'sal_lead_modal_render' ) ) { sal_lead_modal_render(); }
	wp_footer();
	?>
	</body>
	</html><?php
	exit;
}, 1 );
