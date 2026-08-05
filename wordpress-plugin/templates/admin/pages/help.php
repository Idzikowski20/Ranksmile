<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
$docs = Ranksmile()->url_wpranksmile_docs ?? 'https://ranksmile.pl';
?>
<section class="rs-grid rs-grid--2">
	<div class="rs-card"><div class="rs-card__body">
		<h2 class="rs-card__title"><?php esc_html_e( 'Documentation', 'ranksmileseo' ); ?></h2>
		<p class="rs-hint"><?php esc_html_e( 'Guides for connecting WordPress and publishing from Ranksmile.', 'ranksmileseo' ); ?></p>
		<a class="rs-btn rs-btn--secondary" href="<?php echo esc_url( $docs ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Open docs', 'ranksmileseo' ); ?></a>
	</div></div>
	<div class="rs-card"><div class="rs-card__body">
		<h2 class="rs-card__title"><?php esc_html_e( 'Debug', 'ranksmileseo' ); ?></h2>
		<p class="rs-hint"><?php esc_html_e( 'Download debug data from Settings → Advanced if Support asks for it.', 'ranksmileseo' ); ?></p>
		<a class="rs-btn rs-btn--secondary" href="<?php echo esc_url( admin_url( 'admin.php?page=ranksmile-settings&section=advanced' ) ); ?>"><?php esc_html_e( 'Open Advanced', 'ranksmileseo' ); ?></a>
	</div></div>
	<div class="rs-card"><div class="rs-card__body">
		<h2 class="rs-card__title"><?php esc_html_e( 'Version', 'ranksmileseo' ); ?></h2>
		<p><?php echo esc_html( RANKSMILE_VERSION ); ?> · rsds-v1</p>
	</div></div>
	<div class="rs-card"><div class="rs-card__body">
		<h2 class="rs-card__title"><?php esc_html_e( 'Contact', 'ranksmileseo' ); ?></h2>
		<a class="rs-btn rs-btn--secondary" href="mailto:support@ranksmile.pl">support@ranksmile.pl</a>
	</div></div>
</section>
