<?php
/**
 * Página estática padrão.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo">
	<?php while ( have_posts() ) : ?>
		<?php the_post(); ?>
		<article <?php post_class(); ?>>
			<header class="pagina__cabeca wrap">
				<h1><?php the_title(); ?></h1>
			</header>
			<div class="conteudo wrap">
				<?php the_content(); ?>
			</div>
		</article>
	<?php endwhile; ?>
</main>

<?php
get_footer();
