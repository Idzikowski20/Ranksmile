<?php
/**
 * Advanced settings only — everyday users stay on the Dashboard wizard.
 *
 * @package Ranksmile
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$form = isset( $rs_settings_form ) ? $rs_settings_form : null;
?>
<form action="" method="POST">
	<?php wp_nonce_field( 'ranksmile_settings_save', '_ranksmile_nonce' ); ?>

	<section class="rs-settings-section">
		<h2 class="rs-settings-section__title"><?php esc_html_e( 'Advanced', 'ranksmileseo' ); ?></h2>
		<div class="rs-settings-section__body">
			<p class="rs-settings-row__desc">
				<?php esc_html_e( 'These options are rarely needed. Default connection and Search Console setup live on the Dashboard.', 'ranksmileseo' ); ?>
			</p>
			<?php if ( $form ) : ?>
				<?php $form->render_admin_form(); ?>
			<?php endif; ?>
			<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
				<button type="submit" class="rs-btn rs-btn--primary rs-btn--sm"><?php esc_html_e( 'Save changes', 'ranksmileseo' ); ?></button>
				<a class="rs-btn rs-btn--secondary rs-btn--sm" target="_blank" href="<?php echo esc_url( admin_url( 'admin.php?page=ranksmile-settings&section=advanced&action=download_debug_data&_wpnonce=' . wp_create_nonce( 'ranksmile_admin_actions' ) ) ); ?>"><?php esc_html_e( 'Download debug data', 'ranksmileseo' ); ?></a>
			</div>
		</div>
	</section>
</form>
