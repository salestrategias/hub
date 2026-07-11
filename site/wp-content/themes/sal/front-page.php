<?php
/**
 * Home institucional.
 *
 * Textos de destaque (hero, números, depoimento, CTA final) são editáveis
 * em Aparência → Personalizar → SAL. As seções fixas (nichos, serviços,
 * método) vivem aqui — são o posicionamento da agência e mudam junto
 * com a estratégia, não com a rotina.
 *
 * @package sal
 */

get_header();
?>

<main id="conteudo">

	<!-- Abertura -->
	<section class="hero">
		<div class="wrap hero__grid">
			<div>
				<p class="kicker"><?php echo esc_html( sal_mod( 'sal_hero_kicker' ) ); ?></p>
				<h1><?php echo esc_html( sal_mod( 'sal_hero_titulo' ) ); ?></h1>
				<p class="hero__sub"><?php echo esc_html( sal_mod( 'sal_hero_sub' ) ); ?></p>
				<div class="hero__acoes">
					<a class="btn btn--solido" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php echo esc_html( sal_mod( 'sal_cta_texto' ) ); ?> <span class="seta" aria-hidden="true">→</span></a>
					<a class="btn btn--contorno" href="#metodo"><?php esc_html_e( 'Como trabalhamos', 'sal' ); ?></a>
				</div>
				<p class="hero__nota"><?php echo esc_html( sal_mod( 'sal_hero_nota' ) ); ?></p>
			</div>
			<aside class="hero__aside">
				<p><strong><?php esc_html_e( 'Marketing na Medida Certa.', 'sal' ); ?></strong> <?php echo esc_html( sal_mod( 'sal_hero_aside_1' ) ); ?></p>
				<p><?php echo esc_html( sal_mod( 'sal_hero_aside_2' ) ); ?></p>
			</aside>
		</div>
	</section>

	<!-- Números -->
	<section class="numeros" aria-label="<?php esc_attr_e( 'SAL em números', 'sal' ); ?>">
		<div class="numeros__grid">
			<?php for ( $i = 1; $i <= 3; $i++ ) : ?>
				<div class="numero revela">
					<span class="numero__valor"><?php echo esc_html( sal_mod( "sal_num{$i}_valor" ) ); ?></span>
					<span class="numero__rotulo"><?php echo esc_html( sal_mod( "sal_num{$i}_rotulo" ) ); ?></span>
				</div>
			<?php endfor; ?>
		</div>
	</section>

	<!-- Quem atendemos -->
	<section class="secao" id="quem-atendemos">
		<div class="wrap">
			<div class="secao__cabeca">
				<p class="kicker"><?php esc_html_e( 'Quem atendemos', 'sal' ); ?></p>
				<h2><?php esc_html_e( 'Duas especialidades. Nenhuma distração.', 'sal' ); ?></h2>
				<p><?php esc_html_e( 'A SAL não atende "qualquer empresa". Trabalhamos com quem vende no varejo — na rua ou na internet — porque é onde sabemos fazer o investimento voltar.', 'sal' ); ?></p>
			</div>

			<div class="nichos">
				<article class="nicho revela">
					<span class="tag"><?php esc_html_e( 'Loja física', 'sal' ); ?></span>
					<h3><?php esc_html_e( 'Varejo local', 'sal' ); ?></h3>
					<p><?php esc_html_e( 'Para a loja de bairro, a clínica, o restaurante, o comércio de rua: trazer gente da sua região até o seu balcão.', 'sal' ); ?></p>
					<ul>
						<li><?php esc_html_e( 'Perfil da Empresa no Google otimizado para aparecer no mapa antes do concorrente', 'sal' ); ?></li>
						<li><?php esc_html_e( 'Google e Meta Ads por raio: anúncio só para quem pode chegar até você', 'sal' ); ?></li>
						<li><?php esc_html_e( 'Campanhas de visita à loja e WhatsApp para transformar busca em movimento', 'sal' ); ?></li>
						<li><?php esc_html_e( 'Instagram local com conteúdo que a vizinhança reconhece', 'sal' ); ?></li>
					</ul>
					<p class="nicho__rodape"><a class="btn btn--contorno btn--mini" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php esc_html_e( 'Diagnóstico para minha loja', 'sal' ); ?></a></p>
				</article>

				<article class="nicho revela">
					<span class="tag"><?php esc_html_e( 'Loja virtual', 'sal' ); ?></span>
					<h3><?php esc_html_e( 'E-commerce', 'sal' ); ?></h3>
					<p><?php esc_html_e( 'Para quem vende online e cansou de ROAS bonito com caixa vazio: crescer com margem, não só com faturamento.', 'sal' ); ?></p>
					<ul>
						<li><?php esc_html_e( 'Google Shopping, Performance Max e Meta com feed de catálogo bem-feito', 'sal' ); ?></li>
						<li><?php esc_html_e( 'SEO de produto e categoria para vender sem depender só de mídia paga', 'sal' ); ?></li>
						<li><?php esc_html_e( 'E-mail, WhatsApp e recompra: cliente que volta custa menos que cliente novo', 'sal' ); ?></li>
						<li><?php esc_html_e( 'Metas de ROAS calculadas com comissão, frete e imposto — não chute', 'sal' ); ?></li>
					</ul>
					<p class="nicho__rodape"><a class="btn btn--contorno btn--mini" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php esc_html_e( 'Diagnóstico para meu e-commerce', 'sal' ); ?></a></p>
				</article>
			</div>
		</div>
	</section>

	<!-- Serviços -->
	<section class="secao secao--cool" id="servicos">
		<div class="wrap">
			<div class="secao__cabeca">
				<p class="kicker"><?php esc_html_e( 'O que fazemos', 'sal' ); ?></p>
				<h2><?php esc_html_e( 'Serviços que se combinam num plano só', 'sal' ); ?></h2>
				<p><?php esc_html_e( 'Você não contrata uma lista de entregáveis: contrata um plano. Estes são os instrumentos que usamos para montá-lo.', 'sal' ); ?></p>
			</div>

			<div class="servicos">
				<?php
				$sal_servicos = array(
					array( __( 'Tráfego pago', 'sal' ), __( 'Google, Meta e TikTok Ads com meta de retorno definida antes de investir o primeiro real.', 'sal' ) ),
					array( __( 'SEO e conteúdo', 'sal' ), __( 'Aparecer quando o cliente procura — no Google, no mapa e nas respostas de IA.', 'sal' ) ),
					array( __( 'CRM e retenção', 'sal' ), __( 'E-mail, WhatsApp e fluxos de recompra para aumentar o valor de cada cliente.', 'sal' ) ),
					array( __( 'Social e criativos', 'sal' ), __( 'Conteúdo e anúncios com cara de marca, produzidos para converter — não para encher grade.', 'sal' ) ),
					array( __( 'Dados e margem', 'sal' ), __( 'GA4, acompanhamento de conversão e relatório mensal que fecha a conta em reais.', 'sal' ) ),
					array( __( 'Marketplaces', 'sal' ), __( 'Mercado Livre, Shopee e Instagram Shopping como canais com estratégia própria, não como apêndice.', 'sal' ) ),
				);
				foreach ( $sal_servicos as $sal_i => $sal_servico ) :
					?>
					<article class="servico revela">
						<span class="servico__indice"><?php echo esc_html( str_pad( (string) ( $sal_i + 1 ), 2, '0', STR_PAD_LEFT ) ); ?></span>
						<h3><?php echo esc_html( $sal_servico[0] ); ?></h3>
						<p><?php echo esc_html( $sal_servico[1] ); ?></p>
					</article>
				<?php endforeach; ?>
			</div>
		</div>
	</section>

	<!-- Método -->
	<section class="secao" id="metodo">
		<div class="wrap">
			<div class="secao__cabeca">
				<p class="kicker"><?php esc_html_e( 'Como trabalhamos', 'sal' ); ?></p>
				<h2><?php esc_html_e( 'Do diagnóstico à conta fechada', 'sal' ); ?></h2>
			</div>

			<div class="metodo">
				<div class="passo revela">
					<h3><?php esc_html_e( 'Diagnóstico', 'sal' ); ?></h3>
					<p><?php esc_html_e( 'Analisamos seus canais, seu funil e seus números de graça. Você recebe um parecer honesto — inclusive se a conclusão for "ainda não é hora de investir em mídia".', 'sal' ); ?></p>
				</div>
				<div class="passo revela">
					<h3><?php esc_html_e( 'Plano na medida', 'sal' ); ?></h3>
					<p><?php esc_html_e( 'Com o diagnóstico na mão, montamos o plano: canais, verba, metas e prazos. Tudo dimensionado pelo seu ticket e pela sua margem, não por pacote pronto.', 'sal' ); ?></p>
				</div>
				<div class="passo revela">
					<h3><?php esc_html_e( 'Execução', 'sal' ); ?></h3>
					<p><?php esc_html_e( 'A gente coloca a mão na massa: campanhas, conteúdo, otimização e teste, semana a semana, com você sabendo o que está sendo feito e por quê.', 'sal' ); ?></p>
				</div>
				<div class="passo revela">
					<h3><?php esc_html_e( 'Conta fechada todo mês', 'sal' ); ?></h3>
					<p><?php esc_html_e( 'Relatório mensal em reais: quanto entrou, quanto saiu, o que aprendemos e o que muda no mês seguinte. Se um canal não se paga, ele sai do plano.', 'sal' ); ?></p>
				</div>
			</div>
		</div>
	</section>

	<?php $sal_depo = sal_mod( 'sal_depo_texto' ); ?>
	<?php if ( $sal_depo ) : ?>
		<!-- Depoimento -->
		<section class="secao" aria-label="<?php esc_attr_e( 'Depoimento', 'sal' ); ?>">
			<div class="wrap">
				<figure class="depoimento revela">
					<blockquote><?php echo esc_html( $sal_depo ); ?></blockquote>
					<figcaption><?php echo esc_html( sal_mod( 'sal_depo_autor' ) ); ?></figcaption>
				</figure>
			</div>
		</section>
	<?php endif; ?>

	<?php
	$sal_posts = new WP_Query( array(
		'posts_per_page'      => 3,
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
	) );
	?>
	<?php if ( $sal_posts->have_posts() ) : ?>
		<!-- Blog -->
		<section class="secao secao--cool" id="blog">
			<div class="wrap">
				<div class="secao__cabeca">
					<p class="kicker"><?php esc_html_e( 'Do blog', 'sal' ); ?></p>
					<h2><?php esc_html_e( 'O que estamos aprendendo com varejo e e-commerce', 'sal' ); ?></h2>
					<?php $sal_pagina_blog = (int) get_option( 'page_for_posts' ); ?>
					<p>
						<a href="<?php echo esc_url( $sal_pagina_blog ? get_permalink( $sal_pagina_blog ) : home_url( '/blog/' ) ); ?>"><?php esc_html_e( 'Ver todos os artigos', 'sal' ); ?> <span class="seta" aria-hidden="true">→</span></a>
					</p>
				</div>
				<div class="posts-home">
					<?php
					while ( $sal_posts->have_posts() ) {
						$sal_posts->the_post();
						sal_card_post();
					}
					wp_reset_postdata();
					?>
				</div>
			</div>
		</section>
	<?php endif; ?>

	<!-- Chamada final -->
	<section class="secao cta-final">
		<div class="wrap cta-final__grid">
			<div>
				<h2><?php echo esc_html( sal_mod( 'sal_final_titulo' ) ); ?></h2>
				<p><?php echo esc_html( sal_mod( 'sal_final_texto' ) ); ?></p>
			</div>
			<div>
				<a class="btn btn--claro" href="<?php echo esc_url( sal_cta_url() ); ?>"><?php echo esc_html( sal_mod( 'sal_cta_texto' ) ); ?> <span class="seta" aria-hidden="true">→</span></a>
			</div>
		</div>
	</section>

</main>

<?php
get_footer();
