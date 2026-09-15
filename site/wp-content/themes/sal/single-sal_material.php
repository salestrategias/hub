<?php
/**
 * Página de um material rico: descrição + download + assinatura da newsletter.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo">
	<?php while ( have_posts() ) : ?>
		<?php the_post(); ?>
		<?php $sal_arquivo = get_post_meta( get_the_ID(), 'sal_material_url', true ); ?>

		<article <?php post_class(); ?>>
			<header class="artigo__cabeca wrap">
				<?php sal_breadcrumbs( array( __( 'Materiais', 'sal' ) => get_post_type_archive_link( 'sal_material' ) ) ); ?>
				<h1><?php the_title(); ?></h1>
				<?php if ( has_excerpt() ) : ?>
					<p class="pagina__sub"><?php echo esc_html( get_the_excerpt() ); ?></p>
				<?php endif; ?>
				<?php if ( $sal_arquivo ) : ?>
					<p><a class="btn btn--solido" href="<?php echo esc_url( $sal_arquivo ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Baixar material', 'sal' ); ?> <span class="seta" aria-hidden="true">↓</span></a></p>
				<?php endif; ?>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
				<figure class="artigo__capa wrap">
					<?php the_post_thumbnail( 'large' ); ?>
				</figure>
			<?php endif; ?>

			<div class="conteudo wrap">
				<?php the_content(); ?>
			</div>

			<footer class="artigo__rodape wrap">
				<?php echo sal_newsletter_form( __( 'Gostou do material? Tem mais toda semana.', 'sal' ) ); // phpcs:ignore WordPress.Security.EscapeOutput -- HTML montado com escaping interno. ?>
			</footer>
		</article>
	<?php endwhile; ?>
</main>

<?php
get_footer();
