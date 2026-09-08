<?php
/**
 * Helpers de exibição usados pelos templates.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Logo real da SAL (SVG embarcado no tema). Um logo enviado em
 * Aparência → Personalizar tem prioridade sobre o arquivo do tema.
 *
 * @param string $variante 'cor' (fundo claro) ou 'branco' (fundo escuro).
 */
function sal_logo( string $variante = 'cor' ): void {
	if ( has_custom_logo() && 'cor' === $variante ) {
		the_custom_logo();
		return;
	}
	$arquivo = 'branco' === $variante ? 'sal-logo-branco.svg' : 'sal-logo.svg';
	printf(
		'<a class="logo" href="%s" rel="home"><img src="%s" alt="%s" width="120" height="68"></a>',
		esc_url( home_url( '/' ) ),
		esc_url( get_template_directory_uri() . '/assets/img/' . $arquivo ),
		esc_attr( get_bloginfo( 'name' ) )
	);
}

/**
 * URL do CTA principal: aceita caminho relativo ("/diagnostico/") ou URL completa.
 */
function sal_cta_url(): string {
	$url = sal_mod( 'sal_cta_url' );
	if ( $url && ! preg_match( '#^https?://#i', $url ) ) {
		$url = home_url( $url );
	}
	return $url ?: home_url( '/diagnostico/' );
}

/**
 * Link do WhatsApp a partir do número salvo (só dígitos). Vazio = sem botão.
 */
function sal_whatsapp_url(): string {
	$numero = preg_replace( '/\D/', '', sal_mod( 'sal_whatsapp' ) );
	return $numero ? 'https://wa.me/' . $numero : '';
}

/**
 * Card de post (usado na home, arquivo e busca).
 */
function sal_card_post(): void {
	?>
	<article class="card-post">
		<?php if ( has_post_thumbnail() ) : ?>
			<a class="card-post__capa" href="<?php the_permalink(); ?>" tabindex="-1" aria-hidden="true">
				<?php the_post_thumbnail( 'sal-card', array( 'loading' => 'lazy' ) ); ?>
			</a>
		<?php endif; ?>
		<div class="card-post__corpo">
			<div class="card-post__meta">
				<?php
				$categoria = get_the_category();
				if ( $categoria ) {
					echo '<span class="tag">' . esc_html( $categoria[0]->name ) . '</span>';
				}
				?>
				<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
			</div>
			<h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
			<p><?php echo esc_html( get_the_excerpt() ); ?></p>
		</div>
	</article>
	<?php
}

/**
 * Breadcrumbs simples com JSON-LD BreadcrumbList.
 * Uso: sal_breadcrumbs( array( 'Serviços' => home_url('/servicos/') ) );
 * O último item é sempre a página atual (sem link).
 */
function sal_breadcrumbs( array $meio = array() ): void {
	$trilha = array( __( 'Início', 'sal' ) => home_url( '/' ) ) + $meio;
	$atual  = get_the_title();

	echo '<nav class="trilha" aria-label="' . esc_attr__( 'Você está em', 'sal' ) . '"><ol>';
	$schema = array();
	$pos    = 1;
	foreach ( $trilha as $rotulo => $url ) {
		echo '<li><a href="' . esc_url( $url ) . '">' . esc_html( $rotulo ) . '</a></li>';
		$schema[] = array( '@type' => 'ListItem', 'position' => $pos++, 'name' => $rotulo, 'item' => $url );
	}
	echo '<li aria-current="page">' . esc_html( $atual ) . '</li>';
	$schema[] = array( '@type' => 'ListItem', 'position' => $pos, 'name' => $atual );
	echo '</ol></nav>';

	echo '<script type="application/ld+json">' . wp_json_encode( array(
		'@context'        => 'https://schema.org',
		'@type'           => 'BreadcrumbList',
		'itemListElement' => $schema,
	), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
}

/**
 * Menu padrão enquanto nenhum menu é atribuído no painel:
 * âncoras das seções da home + blog.
 */
function sal_menu_padrao(): void {
	$home = esc_url( home_url( '/' ) );
	echo '<ul>';
	echo '<li><a href="' . $home . 'servicos/seo-para-ecommerce/">' . esc_html__( 'SEO', 'sal' ) . '</a></li>';
	echo '<li><a href="' . $home . 'servicos/gestao-de-trafego-pago/">' . esc_html__( 'Tráfego Pago', 'sal' ) . '</a></li>';
	echo '<li><a href="' . $home . 'materiais/">' . esc_html__( 'Materiais', 'sal' ) . '</a></li>';
	echo '<li><a href="' . $home . 'blog/">' . esc_html__( 'Blog', 'sal' ) . '</a></li>';
	echo '<li><a href="' . $home . 'quem-somos/">' . esc_html__( 'Quem somos', 'sal' ) . '</a></li>';
	echo '</ul>';
}

/**
 * Paginação de arquivos com marcação acessível.
 */
function sal_paginacao(): void {
	$links = paginate_links( array(
		'mid_size'  => 1,
		'prev_text' => __( '← Anteriores', 'sal' ),
		'next_text' => __( 'Próximos →', 'sal' ),
		'type'      => 'plain',
	) );
	if ( $links ) {
		echo '<nav class="paginacao" aria-label="' . esc_attr__( 'Paginação', 'sal' ) . '">' . $links . '</nav>'; // phpcs:ignore WordPress.Security.EscapeOutput -- paginate_links já retorna HTML seguro.
	}
}
