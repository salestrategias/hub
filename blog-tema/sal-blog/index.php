<?php
/**
 * Reserva para qualquer rota sem template próprio (arquivo de data, tag,
 * página avulsa remanescente): lista simples no mesmo desenho.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();
?>

<main id="conteudo">
	<section class="masthead masthead-ed">
		<div class="wrap">
			<nav class="migalha" aria-label="Você está em"><a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Blog</a></nav>
			<h1><?php echo esc_html( wp_strip_all_tags( get_the_archive_title() ?: 'Blog da SAL' ) ); ?></h1>
		</div>
	</section>
	<section class="faixa">
		<div class="wrap">
			<?php if ( have_posts() ) : ?>
				<div class="grade">
					<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', null, array( 'post' => get_post() ) ); endwhile; ?>
				</div>
				<nav class="paginas" aria-label="Páginas">
					<?php echo paginate_links( array( 'prev_text' => '← Anteriores', 'next_text' => 'Próximos →', 'mid_size' => 2 ) ); ?>
				</nav>
			<?php else : ?>
				<p class="vazio">Nada por aqui. Comece pelas <a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">últimas publicações</a>.</p>
			<?php endif; ?>
		</div>
	</section>
</main>

<?php get_footer(); ?>
