<?php
/**
 * O portal: /blog/. Manchete, últimas, editorias, guias e newsletter.
 * O h1 é do portal — o título da manchete pertence à página do artigo.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();

$recentes = get_posts( array( 'numberposts' => 9 ) );
$manchete = $recentes ? array_shift( $recentes ) : null;

// Guias de fundação: os artigos que todo lojista deveria ler primeiro.
$guias = get_posts( array(
	'post_name__in' => array(
		'roas-alto-mas-sem-lucro',
		'loja-virtual-nao-vende-o-que-fazer',
		'como-estruturar-marketing-de-uma-loja',
		'cac-e-ltv-como-calcular-metricas-negocio',
	),
	'numberposts'   => 4,
	'orderby'       => 'post_name__in',
) );
?>

<main id="conteudo">

	<section class="masthead">
		<div class="wrap">
			<h1>Blog da SAL<span>Marketing, SEO, varejo e e-commerce, sem enrolação.</span></h1>
			<nav class="pills" aria-label="Editorias">
				<?php foreach ( array_slice( sal_editorias(), 0, 5 ) as $ed ) : ?>
					<a href="<?php echo esc_url( get_category_link( $ed ) ); ?>"><?php echo esc_html( $ed->name ); ?></a>
				<?php endforeach; ?>
			</nav>
			<?php get_template_part( 'parts/busca', null, array( 'id' => 'busca-portal' ) ); ?>
		</div>
	</section>

	<?php if ( $manchete ) : $mimg = get_the_post_thumbnail_url( $manchete, 'full' ); $mcat = sal_categoria( $manchete ); ?>
	<section class="manchete">
		<div class="wrap manchete-grade">
			<div>
				<span class="eyebrow"><?php echo $mcat ? esc_html( $mcat->name ) : 'Em destaque'; ?></span>
				<h2><a href="<?php echo esc_url( get_permalink( $manchete ) ); ?>"><?php echo esc_html( get_the_title( $manchete ) ); ?></a></h2>
				<p class="dek"><?php echo esc_html( wp_trim_words( get_the_excerpt( $manchete ), 32 ) ); ?></p>
				<div class="meta">Marcelo Freitas · <?php echo esc_html( sal_data( $manchete ) ); ?> · <?php echo (int) sal_leitura( $manchete ); ?> min de leitura</div>
				<a class="btn btn-primary" href="<?php echo esc_url( get_permalink( $manchete ) ); ?>">Ler agora →</a>
			</div>
			<a class="manchete-capa" href="<?php echo esc_url( get_permalink( $manchete ) ); ?>" aria-label="<?php echo esc_attr( get_the_title( $manchete ) ); ?>">
				<figure><?php if ( $mimg ) : ?><img src="<?php echo esc_url( $mimg ); ?>" alt="" width="1200" height="675" fetchpriority="high" decoding="async"><?php endif; ?></figure>
			</a>
		</div>
	</section>
	<?php endif; ?>

	<section class="faixa">
		<div class="wrap">
			<h2 class="rotulo">Últimas</h2>
			<div class="grade">
				<?php foreach ( $recentes as $p ) { get_template_part( 'parts/card', null, array( 'post' => $p ) ); } ?>
			</div>
		</div>
	</section>

	<?php foreach ( array_slice( sal_editorias(), 0, 4 ) as $ed ) :
		$do_ed = get_posts( array( 'numberposts' => 3, 'category' => $ed->term_id ) );
		if ( ! $do_ed ) { continue; }
	?>
	<section class="faixa faixa-ed">
		<div class="wrap">
			<div class="faixa-cabeca">
				<h2 class="rotulo"><?php echo esc_html( $ed->name ); ?></h2>
				<a class="ver-tudo" href="<?php echo esc_url( get_category_link( $ed ) ); ?>">Ver editoria →</a>
			</div>
			<div class="grade">
				<?php foreach ( $do_ed as $p ) { get_template_part( 'parts/card', null, array( 'post' => $p ) ); } ?>
			</div>
		</div>
	</section>
	<?php endforeach; ?>

	<?php if ( $guias ) : ?>
	<section class="guias">
		<div class="wrap">
			<h2 class="rotulo rotulo-claro">Comece por aqui</h2>
			<p class="guias-sub">Os artigos de fundação: a conta que protege a sua margem, o diagnóstico da loja que não vende e as bases de tráfego e SEO.</p>
			<ol class="guias-lista">
				<?php foreach ( $guias as $g ) : ?>
					<li><a href="<?php echo esc_url( get_permalink( $g ) ); ?>"><?php echo esc_html( get_the_title( $g ) ); ?></a></li>
				<?php endforeach; ?>
			</ol>
		</div>
	</section>
	<?php endif; ?>

	<?php get_template_part( 'parts/news' ); ?>

</main>

<?php get_footer(); ?>
