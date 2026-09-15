<?php
/** Página não encontrada. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();
?>

<main id="conteudo">
	<section class="masthead masthead-ed erro404">
		<div class="wrap">
			<h1>Essa página não existe.</h1>
			<p class="dek">O endereço pode ter mudado ou nunca ter existido. O que resolve:</p>
			<div class="erro-acoes">
				<a class="btn btn-primary" href="<?php echo esc_url( home_url( '/blog/' ) ); ?>">Ir para o blog</a>
				<a class="btn btn-ghost" href="/">Ir para o site da SAL</a>
			</div>
			<?php get_template_part( 'parts/busca', null, array( 'id' => 'busca-404' ) ); ?>
		</div>
	</section>
</main>

<?php get_footer(); ?>
