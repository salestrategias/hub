<?php
/**
 * Página não encontrada.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo">
	<div class="wrap pagina-vazia">
		<p class="gigante" aria-hidden="true">404</p>
		<h1><?php esc_html_e( 'Essa página não existe (ou mudou de lugar)', 'sal' ); ?></h1>
		<p><?php esc_html_e( 'O endereço pode ter sido digitado errado, ou o conteúdo foi movido. Tente buscar pelo assunto:', 'sal' ); ?></p>
		<?php get_search_form(); ?>
		<p style="margin-top:1.5rem;"><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( '← Voltar para a página inicial', 'sal' ); ?></a></p>
	</div>
</main>

<?php
get_footer();
