<?php
/**
 * Listagem padrão (blog e fallback geral).
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo" class="secao">
	<div class="wrap">
		<header class="arquivo-cabeca secao__cabeca">
			<p class="kicker"><?php esc_html_e( 'Blog', 'sal' ); ?></p>
			<h1><?php echo esc_html( get_the_title( get_option( 'page_for_posts' ) ) ?: __( 'Artigos', 'sal' ) ); ?></h1>
			<p class="descricao"><?php esc_html_e( 'Guias e artigos sobre SEO, tráfego pago e gestão para quem tem loja, física ou virtual. Publicamos todos os dias.', 'sal' ); ?></p>
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
				<p><?php esc_html_e( 'Nada publicado por aqui ainda.', 'sal' ); ?></p>
			</div>
		<?php endif; ?>
	</div>
</main>

<?php
get_footer();
