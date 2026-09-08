<?php
/**
 * Arquivo de materiais ricos (/materiais/): grade de downloads + newsletter.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo" class="secao">
	<div class="wrap">
		<header class="arquivo-cabeca secao__cabeca">
			<p class="kicker"><?php esc_html_e( 'Materiais', 'sal' ); ?></p>
			<h1><?php esc_html_e( 'Materiais gratuitos para varejo e e-commerce', 'sal' ); ?></h1>
			<p class="descricao"><?php esc_html_e( 'Checklists, planilhas e guias que a gente usa no dia a dia da SAL, prontos para você aplicar na sua loja.', 'sal' ); ?></p>
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
				<p><?php esc_html_e( 'Os primeiros materiais estão em produção. Assine a newsletter para receber quando saírem.', 'sal' ); ?></p>
			</div>
		<?php endif; ?>

		<div class="secao-news">
			<?php echo sal_newsletter_form(); // phpcs:ignore WordPress.Security.EscapeOutput -- HTML montado com escaping interno. ?>
		</div>
	</div>
</main>

<?php
get_footer();
