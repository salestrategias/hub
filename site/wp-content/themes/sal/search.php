<?php
/**
 * Resultados de busca.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo" class="secao">
	<div class="wrap">
		<header class="arquivo-cabeca secao__cabeca">
			<p class="kicker"><?php esc_html_e( 'Busca', 'sal' ); ?></p>
			<h1>
				<?php
				/* translators: %s: termo buscado. */
				printf( esc_html__( 'Resultados para “%s”', 'sal' ), esc_html( get_search_query() ) );
				?>
			</h1>
			<?php get_search_form(); ?>
		</header>

		<?php if ( have_posts() ) : ?>
			<div class="arquivo-lista">
				<?php
				while ( have_posts() ) {
					the_post();
					sal_card_post();
				}
				?>
			</div>
			<?php sal_paginacao(); ?>
		<?php else : ?>
			<div class="pagina-vazia">
				<p><?php esc_html_e( 'Não achamos nada com esse termo. Tente outra palavra, ou fale direto com a gente.', 'sal' ); ?></p>
			</div>
		<?php endif; ?>
	</div>
</main>

<?php
get_footer();
