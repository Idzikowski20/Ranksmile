<?php
/**
 * Wizard template
 *
 * @package Ranksmile
 */

if ( ! defined( 'ABSPATH' ) ) exit;

?>
<div class="wrap wizard-wrapper">

	<header class="wizard-wrapper__header">
		<?php ranksmile_image_printer( Ranksmile()->get_baseurl() . 'assets/images/ranksmile_logo.svg', 'Ranksmile Logo', '', '' ); ?>
		<h3><?php esc_html_e( 'Help us making Ranksmile better for you', 'ranksmileseo' ); ?></h3>
	</header>

	<article class="wizard-wrapper__content">

		<p><?php esc_html_e( 'We want to gather some basic information about how you are using the plugin, to make it better for you.', 'ranksmileseo' ); ?></p>
		<p><?php esc_html_e( 'What data we gather?', 'ranksmileseo' ); ?></p>
		<ul>
			<li><?php esc_html_e( 'What features of Ranksmile plugin you are using,', 'ranksmileseo' ); ?></li>
			<li><?php esc_html_e( 'Your PHP and WordPress versions,', 'ranksmileseo' ); ?></li>
			<li><?php esc_html_e( 'What plugins are you using.', 'ranksmileseo' ); ?></li>
		</ul>
		<p><?php esc_html_e( 'This data will allow us to focus on developing most importat features, and prioriterize integrations with most popular plugins.', 'ranksmileseo' ); ?></p>

		<p><?php esc_html_e( 'You can disable tracking everytime you want.', 'ranksmileseo' ); ?></p>

		<?php /* translators: %s URL to privacy policy  */ ?>
		<p><?php printf( wp_kses( __( 'If you have any questions, please read our <a href="%s" target="_blank">privacy policy</a> or contact our support team.', 'ranksmileseo' ), 'a' ), esc_html( Ranksmile()->get_plugin()->get_privacy_policy_url() ) ); ?></p>

		<a href="<?php echo esc_url( admin_url( 'admin.php?page=ranksmile&ranksmile_enable_tracking=1' ) ); ?>" class="button button-ranksmile-primary"><?php esc_html_e( 'Allow tracking', 'ranksmileseo' ); ?></a>
		<a href="<?php echo esc_url( admin_url( 'admin.php?page=ranksmile' ) ); ?>" class="button button-ranksmile"><?php esc_html_e( 'Skip', 'ranksmileseo' ); ?></a>
	</article>

</div>
