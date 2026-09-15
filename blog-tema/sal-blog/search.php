<?php
/** Busca do blog. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();
?>

<main id="conteudo">

	<section class="masthead masthead-ed">
		<div class="wrap">
			<nav class="migalha" aria-label="Você está em"><a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Blog</a> › Busca</nav>
			<h1>Resultados para “<?php echo esc_html( get_search_query() ); ?>”</h1>
			<?php get_template_part( 'parts/busca', null, array( 'id' => 'busca-q' ) ); ?>
		</div>
	</section>

	<section class="faixa">
		<div class="wrap">
			<?php if ( have_posts() ) : ?>
				<div class="grade">
					<?php while ( have_posts() ) : the_post(); if ( 'post' === get_post_type() ) { get_template_part( 'parts/card', null, array( 'post' => get_post() ) ); } endwhile; ?>
				</div>
				<nav class="paginas" aria-label="Páginas">
					<?php echo paginate_links( array( 'prev_text' => '← Anteriores', 'next_text' => 'Próximos →', 'mid_size' => 2 ) ); ?>
				</nav>
			<?php else : ?>
				<p class="vazio">Nada por aqui com esse termo. Tente outra palavra, ou comece pelas <a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">últimas publicações</a>.</p>
			<?php endif; ?>
		</div>
	</section>

</main>

<?php get_footer(); ?>
