<?php
/**
 * Template for general Ranksmile plugin settings.
 *
 * @package Ranksmile.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Ranksmile\Ranksmileseo;

?>

<div class="wrap ranksmile-layout">
	<h1><?php esc_html_e( 'Ranksmile: Settings', 'ranksmileseo' ); ?></h1>

	<?php if ( isset( $error ) && true === $error ) : ?>
		<div class="notice error ranksmile-error is-dismissible" >
			<p><?php esc_html_e( 'There is an error in your form.', 'ranksmileseo' ); ?></p>
		</div>
	<?php endif; ?>

	<?php if ( isset( $success ) && true === $success ) : ?>
		<div class="notice updated ranksmile-success is-dismissible" >
			<p><?php esc_html_e( 'Form saved properly.', 'ranksmileseo' ); ?></p>
		</div>
	<?php endif; ?>

	<form action="" method="POST">
		<div class="ranksmile-wrapper">
			<div class="ranksmile-wrapper__logo">
				<?php ranksmile_image_printer( Ranksmile()->get_baseurl() . 'assets/images/ranksmile_logo.svg', 'Ranksmile Logo', '', '' ); ?>
			</div>
			<div class="ranksmile-wrapper__content">

				<?php wp_nonce_field( 'ranksmile_settings_save', '_ranksmile_nonce' ); ?>

				<?php if ( isset( $form ) ) : ?>
					<?php $form->render_admin_form(); ?>
				<?php endif; ?>

				<div class="ranksmile-admin-footer">

					<div class="ranksmile-debug-box ranksmile-connected">
						<h3><?php esc_html_e( 'Debugging', 'ranksmileseo' ); ?></h3>
						<p>
							<?php esc_html_e( 'In case you have any troubles with the plugin, please click the button below to download a .txt file with debug information, and send it to our Support team. This will speed up the debug process. Thank you.', 'ranksmileseo' ); ?>
						</p>
						<div class="ranksmile-debug-buttons">
							<a class="ranksmile-button ranksmile-button--secondary ranksmile-button--small" target="_blank" href="<?php echo esc_html( admin_url( 'admin.php?page=ranksmile&action=download_debug_data&_wpnonce=' . wp_create_nonce( 'ranksmile_admin_actions' ) ) ); ?>">
								<?php esc_html_e( 'Download debug data', 'ranksmileseo' ); ?>
							</a>
							<a class="ranksmile-button ranksmile-button--secondary ranksmile-button--small" target="_blank" href="<?php echo esc_html( admin_url( 'admin.php?page=ranksmile&action=download_import_logs&_wpnonce=' . wp_create_nonce( 'ranksmile_admin_actions' ) ) ); ?>">
								<?php esc_html_e( 'Download import logs', 'ranksmileseo' ); ?>
							</a>
							<a class="ranksmile-button ranksmile-button--secondary ranksmile-button--small" target="_blank" href="<?php echo esc_html( admin_url( 'admin.php?page=ranksmile&action=download_export_logs&_wpnonce=' . wp_create_nonce( 'ranksmile_admin_actions' ) ) ); ?>">
								<?php esc_html_e( 'Download export logs', 'ranksmileseo' ); ?>
							</a>
						</div>
					</div>

					<?php /* translators: %1$s & %2$s is replaced with "url" */ ?>
					<?php printf( wp_kses( __( 'In case of questions or troubles, please check our <a href="%1$s" target="_blank">documentation</a> or contact our <a href="%2$s" target="_blank">support team.</a>', 'ranksmileseo' ), wp_kses_allowed_html( 'post' ) ), esc_html( Ranksmileseo::get_instance()->url_wpranksmile_docs ), esc_html( 'mailto:support@ranksmile.pl' ) ); ?>
				</div>
			</div>
		</div>
	</form>
</div>
