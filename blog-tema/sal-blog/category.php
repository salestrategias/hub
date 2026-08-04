<?php
/** Editoria: arquivo de categoria com paginação de verdade. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();

$termo = get_queried_object();
?>

<main id="conteudo">

	<section class="masthead masthead-ed">
		<div class="wrap">
			<nav class="migalha" aria-label="Você está em"><a href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Blog</a> › <?php echo esc_html( $termo->name ); ?></nav>
			<h1><?php echo esc_html( $termo->name ); ?></h1>
			<?php if ( category_description() ) : ?>
				<p class="dek"><?php echo wp_kses_post( category_description() ); ?></p>
			<?php endif; ?>
			<p class="conta"><?php echo (int) $termo->count; ?> artigo<?php echo 1 === (int) $termo->count ? '' : 's'; ?> publicados</p>
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
				<p class="vazio">Ainda não há artigos nesta editoria.</p>
			<?php endif; ?>
		</div>
	</section>

</main>

<?php get_footer(); ?>
