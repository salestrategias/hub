<?php
/**
 * Template Name: Página institucional (visual novo)
 * Template Post Type: page
 *
 * Igual à LP de serviço, mas sem o rótulo "Serviços" no breadcrumb e sem
 * schema Service. Render direto do conteúdo (ignora layout antigo de builder).
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
				<?php sal_breadcrumbs(); ?>
				<h1><?php the_title(); ?></h1>
				<?php if ( has_excerpt() ) : ?>
					<p class="pagina__sub"><?php echo esc_html( get_the_excerpt() ); ?></p>
				<?php endif; ?>
			</header>

			<div class="conteudo wrap">
				<?php echo do_shortcode( shortcode_unautop( wpautop( get_the_content() ) ) ); // phpcs:ignore WordPress.Security.EscapeOutput -- conteúdo autoral confiável do editor. ?>
			</div>

			<footer class="artigo__rodape wrap">
				<div class="artigo-cta">
					<h2><?php echo esc_html( sal_mod( 'sal_final_titulo' ) ); ?></h2>
					<p><?php echo esc_html( sal_mod( 'sal_final_texto' ) ); ?></p>
					<a class="btn btn--claro" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php echo esc_html( sal_mod( 'sal_cta_texto' ) ); ?> <span class="seta" aria-hidden="true">→</span></a>
				</div>
			</footer>
		</article>
	<?php endwhile; ?>
</main>

<?php
get_footer();
