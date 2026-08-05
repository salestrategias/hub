<?php
/**
 * Arquivos: categoria, tag, autor e data.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo" class="secao">
	<div class="wrap">
		<header class="arquivo-cabeca secao__cabeca">
			<p class="kicker"><?php esc_html_e( 'Blog', 'sal' ); ?></p>
			<h1><?php echo esc_html( wp_strip_all_tags( get_the_archive_title() ) ); ?></h1>
			<?php if ( get_the_archive_description() ) : ?>
				<div class="descricao"><?php echo wp_kses_post( get_the_archive_description() ); ?></div>
			<?php endif; ?>
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
				<p><?php esc_html_e( 'Nenhum artigo neste arquivo.', 'sal' ); ?></p>
			</div>
		<?php endif; ?>
	</div>
</main>

<?php
get_footer();
