<?php
/**
 * Class that manage admin section of the plugin.
 *
 * @package Ranksmile
 * @link https://ranksmile.pl
 */

namespace Ranksmile\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Ranksmile\Ranksmileseo;
use Ranksmile\Forms\Ranksmile_Form_Config_Ci;
use Ranksmile\Plugin\Content_Parsers\Parsers_Controller;


/**
 * Controller to store admin part of WPRanksmile
 */
class Ranksmile_Admin {

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_settings_page' ) );

		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );

		add_action( 'admin_init', array( $this, 'init_filters' ) );
		add_action( 'admin_init', array( $this, 'handle_admin_actions' ) );
		add_action( 'admin_init', array( $this, 'do_admin_redirects' ) );

		add_action( 'admin_notices', array( $this, 'check_wordfence_application_password_protection' ) );
		add_action( 'admin_notices', array( $this, 'check_elementor_grid_settings' ) );
	}

	/**
	 * Admin init to call filters.
	 *
	 * @return void
	 */
	public function init_filters() {
		add_filter( 'views_users', array( $this, 'remove_ranksmile_api_role_from_users_lists' ) );
	}

	/**
	 * Register admin menu.
	 */
	public function register_settings_page() {
		add_menu_page(
			'Ranksmile',
			'Ranksmile',
			'manage_options',
			'ranksmile',
			array( $this, 'settings_page' ),
			'data:image/svg+xml;base64,' . base64_encode( file_get_contents( Ranksmileseo::get_instance()->get_basedir() . '/assets/images/admin_menu_logo.svg' ) ) // @codingStandardsIgnoreLine
		);

		$gsc_is_connected = Ranksmile()->get_plugin()->get_gsc()->check_if_gsc_connected();

		if ( $gsc_is_connected ) {
			add_submenu_page( 'ranksmile', __( 'Performance Report', 'ranksmileseo' ), __( 'Performance Report', 'ranksmileseo' ), 'manage_options', 'ranksmile-performance-report', array( $this, 'performance_report_page' ) );
		}
	}

	/**
	 * Ranksmile wp-admin general settings page.
	 */
	public function settings_page() {
		$success = false;
		$error   = false;

		$tab = 'content-importer';

		$form = $this->choose_form_for_tab( $tab );
		$form->bind( Ranksmileseo::get_instance()->get_ranksmile_settings()->get_options( $tab ) );

		if ( isset( $_POST['_ranksmile_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_ranksmile_nonce'] ) ), 'ranksmile_settings_save' ) ) {
			$form_is_valid = $form->validate( $_POST );
			if ( $form_is_valid ) {
				$form->bind( $_POST );
				$form->save( $tab );

				$success = true;
			} else {
				$error = true;
			}
		}

		require_once Ranksmileseo::get_instance()->get_basedir() . '/templates/admin/settings.php';
	}

	/**
	 * Renders page for performance Report.
	 */
	public function performance_report_page() {

		Ranksmile()->get_plugin()->enqueue_ranksmile_react_apps();

		require_once Ranksmileseo::get_instance()->get_basedir() . '/templates/admin/performance-report.php';
	}

	/**
	 * Returns proper form for selected tab.
	 *
	 * @param string $tab - tab that is currently open.
	 * @return mixed
	 */
	private function choose_form_for_tab( $tab ) {
		if ( 'content-importer' === $tab ) {
			return new Ranksmile_Form_Config_Ci();
		}

		return false;
	}

	/**
	 * Enqueue all scripts needed by plugin in wp-admin.
	 *
	 * @param string $hook_suffix Admin page hook suffix.
	 */
	public function admin_enqueue_scripts( $hook_suffix = '' ) {
		unset( $hook_suffix );

		if ( ! function_exists( 'get_current_screen' ) ) {
			return;
		}

		$screen = get_current_screen();
		if ( empty( $screen ) ) {
			return;
		}

		// These scripts are only needed on Ranksmile admin pages.
		$is_ranksmile_page = ( false !== strpos( (string) $screen->id, 'toplevel_page_ranksmile' ) )
			|| ( 0 === strpos( (string) $screen->id, 'ranksmile_page_' ) );

		if ( ! $is_ranksmile_page ) {
			return;
		}

		$connected        = Ranksmile()->get_plugin()->is_ranksmile_connected();
		$tracking_enabled = Ranksmile()->get_ranksmile_tracking()->is_tracking_allowed();

		wp_enqueue_script( 'ranksmile_connection', Ranksmileseo::get_instance()->get_baseurl() . 'assets/js/ranksmile-connector.js', array( 'jquery' ), RANKSMILE_VERSION, true );
		wp_localize_script(
			'ranksmile_connection',
			'ranksmile_connection_lang',
			array(
				'ajaxurl'           => admin_url( 'admin-ajax.php' ),
				'popup_block_error' => __( 'Please allow popup, to connect with Ranksmile', 'ranksmileseo' ),
				'_ranksmile_nonce'     => wp_create_nonce( 'ranksmile-ajax-nonce' ),
				'connected'         => $connected,
			)
		);

		wp_enqueue_script( 'ranksmile_gsc_checker', Ranksmileseo::get_instance()->get_baseurl() . 'assets/js/ranksmile-gsc-checker.js', array( 'jquery' ), RANKSMILE_VERSION, true );
		wp_localize_script(
			'ranksmile_gsc_checker',
			'ranksmile_lang',
			array(
				'ajaxurl'       => admin_url( 'admin-ajax.php' ),
				'_ranksmile_nonce' => wp_create_nonce( 'ranksmile-ajax-nonce' ),
			)
		);

		wp_enqueue_script( 'ranksmile_analytics', Ranksmileseo::get_instance()->get_baseurl() . 'assets/js/ranksmile-analytics.js', array( 'jquery' ), RANKSMILE_VERSION, true );
		wp_localize_script(
			'ranksmile_analytics',
			'ranksmile_analytics_lang',
			array(
				'ajaxurl'          => admin_url( 'admin-ajax.php' ),
				'_ranksmile_nonce'    => wp_create_nonce( 'ranksmile-ajax-nonce' ),
				'tracking_enabled' => $tracking_enabled,
			)
		);
	}

	/**
	 * Hides role Ranksmile API in wp-admin -> Users list.
	 *
	 * @param array $views - list of views, in case of users list, list of roles.
	 * @return array
	 */
	public function remove_ranksmile_api_role_from_users_lists( $views ) {
		if ( ! isset( $views['ranksmile_api'] ) ) {
			return $views;
		}

		if ( isset( $views['all'] ) ) {
			$ranksmile_api_orig_s = $this->extract_view_quantity( $views['ranksmile_api'] );
			$ranksmile_api_int    = $this->extract_int( $ranksmile_api_orig_s );

			$all_orig_s   = $this->extract_view_quantity( $views['all'] );
			$all_orig_int = $this->extract_int( $all_orig_s );

			$all_new_int = $all_orig_int - $ranksmile_api_int;
			$all_new_s   = number_format_i18n( $all_new_int );

			$views['all'] = str_replace( $all_orig_s, $all_new_s, $views['all'] );
		}

		unset( $views['ranksmile_api'] );
		return $views;
	}

	/**
	 * Extract number from string
	 *
	 * @param string $text - Text to extract from.
	 * @return int
	 */
	private function extract_view_quantity( $text ) {
		$match  = array();
		$result = preg_match( '#\((.*?)\)#', $text, $match );
		if ( $result ) {
			$quantity = $match[1];
		} else {
			$quantity = 0;
		}

		return $quantity;
	}

	/**
	 * Convert string to simple int.
	 *
	 * @param string $str_val - string value.
	 * @return int
	 */
	private function extract_int( $str_val ) {
		$str_val1 = str_replace( ',', '', $str_val );
		$int_val  = (int) preg_replace( '/[^\-\d]*(\-?\d*).*/', '$1', $str_val1 );

		return $int_val;
	}

	/**
	 * Check if WordFence Application Password Protection is enabled.
	 *
	 * IF Disable WordPress application passwords in WordFence Brute Force Protection
	 * is enabled, REST API is not working. So it have to be disabled (unchecked).
	 *
	 * @return void
	 */
	public function check_wordfence_application_password_protection() {
		if ( ! is_plugin_active( 'wordfence/wordfence.php' ) ) {
			return;
		}

		if ( ! class_exists( '\wfConfig' ) ) {
			return;
		}

		$loginsec_disabled_app_passwords = call_user_func( array( '\wfConfig', 'get' ), 'loginSec_disableApplicationPasswords' );
		if ( 1 === intval( $loginsec_disabled_app_passwords ) ) {
			$class       = 'notice notice-error';
			$disable_url = admin_url( 'admin.php?page=WordfenceWAF&subpage=waf_options#wf-option-loginSec-disableApplicationPasswords-label' );

			/* translators: %s - URL to the option that should be disabled */
			$message = sprintf( __( '<b>WordFence is blocking Ranksmile!</b> <br/>WordFence option "Disable WordPress application passwords" is enabled. This option blocks Ranksmile API and you will be not able to use it. <a href="%s">Please disable this option</a>.', 'ranksmileseo' ), $disable_url );

			$allowed_html = array(
				'b'  => array(),
				'br' => array(),
				'a'  => array( 'href' => array() ),
			);

			printf( '<div class="%1$s"><p>%2$s</p></div>', esc_attr( $class ), wp_kses( $message, $allowed_html ) );
		}
	}

	/**
	 * Check if Elementor Grid Container is enabled.
	 * Without it, export from Ranksmile to Elementor may not work properly.
	 *
	 * @return void
	 */
	public function check_elementor_grid_settings() {

		if ( ! is_plugin_active( 'elementor/elementor.php' ) ) {
			return;
		}

		if ( ! class_exists( '\Elementor\Plugin' ) || ! is_callable( array( '\Elementor\Plugin', 'instance' ) ) ) {
			return;
		}

		$config_parser = Ranksmile()->get_ranksmile_settings()->get_option( 'content-importer', 'default_content_editor', Parsers_Controller::GUTENBERG );

		if ( Parsers_Controller::ELEMENTOR !== $config_parser ) {
			return;
		}

		$elementor = call_user_func( array( '\Elementor\Plugin', 'instance' ) );
		if ( ! is_object( $elementor ) || ! isset( $elementor->experiments ) || ! is_object( $elementor->experiments ) ) {
			return;
		}

		if ( ! is_callable( array( $elementor->experiments, 'is_feature_active' ) ) ) {
			return;
		}

		$old_grid_is_active = $elementor->experiments->is_feature_active( 'container_grid' );
		$new_grid_is_active = $elementor->experiments->is_feature_active( 'container' );

		if ( $old_grid_is_active || $new_grid_is_active ) {
			return;
		}

		$class       = 'notice notice-error';
		$disable_url = admin_url( 'admin.php?page=elementor-settings#e-experiment-container_grid' );

		/* translators: %s - URL to the option that should be disabled */
		$message = sprintf( __( '<b>It appears there may be an issue with Elementor</b> <br/>We have noticed that you are attempting to use the Elementor parser with the Ranksmile plugin while the Grid Container option is disabled. Please be aware that this configuration may lead to errors during the export process from Ranksmile. <a href="%s">Please enable this option</a>.', 'ranksmileseo' ), $disable_url );

		$allowed_html = array(
			'b'  => array(),
			'br' => array(),
			'a'  => array( 'href' => array() ),
		);

		printf( '<div class="%1$s"><p>%2$s</p></div>', esc_attr( $class ), wp_kses( $message, $allowed_html ) );
	}

	/**
	 * Handle redirects to setup/welcome page after install and updates.
	 *
	 * For setup wizard, transient must be present, the user must have access rights, and we must ignore the network/bulk plugin updaters.
	 *
	 * @return void
	 */
	public function do_admin_redirects() {

		// Set on a brand-new install (see Ranksmile_Installer::set_activation_transients).
		if ( ! get_transient( '_ranksmile_activation_redirect' ) ) {
			return;
		}

		// Don't redirect during AJAX, on the network admin, on bulk activation, or
		// for users who can't manage plugins.
		if ( wp_doing_ajax() || is_network_admin() || ! current_user_can( 'activate_plugins' ) || isset( $_GET['activate-multi'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			return;
		}

		// Already on the Ranksmile page – clear the flag and stop (avoids a redirect loop).
		$current_page = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : false; // phpcs:ignore WordPress.Security.NonceVerification
		if ( 'ranksmile' === $current_page ) {
			delete_transient( '_ranksmile_activation_redirect' );
			return;
		}

		delete_transient( '_ranksmile_activation_redirect' );
		wp_safe_redirect( admin_url( 'admin.php?page=ranksmile' ) );
		exit;
	}


	/**
	 * Register Setup Wizard page
	 *
	 * @return void
	 */
	public function create_wizard_page() {
		add_submenu_page(
			null,
			__( 'Ranksmile Setup Wizard', 'ranksmileseo' ),
			__( 'Ranksmile Setup Wizard', 'ranksmileseo' ),
			'manage_options',
			'setup-ranksmile-wizard',
			array( $this, 'wizard_page' ),
		);
	}

	/**
	 * Render Setup Wizard
	 *
	 * @return void
	 */
	public function wizard_page() {
		require_once Ranksmile()->get_basedir() . '/templates/admin/wizard.php';
	}

	/**
	 * Page to download debug data in form of a txt file.
	 */
	public function download_debug_data() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$debug_data = $this->get_debug_data();

		header( 'Content-Type: text/plain' );
		header( 'Content-Disposition: attachment; filename="ranksmile_debug_data.txt"' );
		header( 'Content-Length: ' . strlen( $debug_data ) );
		header( 'Connection: close' );

		echo esc_html( $debug_data );

		exit;
	}

	/**
	 * Prepare debug data.
	 *
	 * @return string
	 */
	private function get_debug_data() {
		$interval = intval( Ranksmileseo::get_instance()->get_ranksmile_settings()->get_option( 'content-importer', 'ranksmile_gsc_data_collection_interval', 7 ) );

		$content  = gmdate( 'd-m-Y H:i:s' ) . PHP_EOL . PHP_EOL;
		$content .= 'HOME URL: ' . home_url() . PHP_EOL . PHP_EOL;
		$content .= 'SITE URL: ' . get_site_url() . PHP_EOL . PHP_EOL;
		$content .= 'AFTER FILTER SITE URL: ' . apply_filters( 'ranksmile_api_base_url', get_site_url() ) . PHP_EOL . PHP_EOL;
		$content .= 'RANKSMILE API KEY: ' . get_option( 'wpranksmile_api_access_key', false ) . PHP_EOL . PHP_EOL;
		$content .= 'RANKSMILE ORGANIZATION: ' . join( PHP_EOL, get_option( 'ranksmile_connection_details', null ) ) . PHP_EOL . PHP_EOL;
		$content .= 'PERMALINK STRUCTURE: ' . get_option( 'permalink_structure', false ) . PHP_EOL . PHP_EOL;
		$content .= 'GSC DATA INTERVAL: ' . $interval . PHP_EOL . PHP_EOL;
		$content .= 'LAST GSC DATA GATHERING: ' . get_option( 'ranksmile_last_gsc_data_update', false ) . PHP_EOL . PHP_EOL;
		$content .= 'NEXT GSC DATA GATHERING: ' . wp_next_scheduled( 'ranksmile_gather_drop_monitor_data' ) . PHP_EOL . PHP_EOL;
		$content .= 'E-MAIL NOTIFICATION ENABLED: ' . Ranksmile()->get_plugin()->get_gsc()->performance_report_email_notification_enabled() . PHP_EOL . PHP_EOL;
		$content .= 'E-MAIL SENT IN LAST 7 days: ' . get_transient( 'ranksmile_gsc_weekly_report_email_sent' ) . PHP_EOL . PHP_EOL;
		$content .= 'RANKSMILE VERSION OPTION: ' . get_option( 'ranksmile_version', false ) . PHP_EOL . PHP_EOL;
		$content .= 'RANKSMILE VERSION NOW: ' . RANKSMILE_VERSION . PHP_EOL . PHP_EOL;
		$content .= 'PHP VERSION: ' . phpversion() . PHP_EOL . PHP_EOL;
		$content .= 'WordPress VERSION: ' . get_bloginfo( 'version' ) . PHP_EOL . PHP_EOL;
		$content .= 'ACTIVE PLUGINS: ' . join( PHP_EOL, Ranksmile()->get_ranksmile_tracking()->get_active_plugins() ) . PHP_EOL . PHP_EOL;

		return $content;
	}

	/**
	 * Handle admin actions.
	 */
	public function handle_admin_actions() {

		if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'ranksmile_admin_actions' ) ) {
			return;
		}

		if ( ! isset( $_GET['page'] ) || 'ranksmile' !== $_GET['page'] ) {
			return;
		}

		if ( ! isset( $_GET['action'] ) ) {
			return;
		}

		$action = sanitize_text_field( wp_unslash( $_GET['action'] ) );

		switch ( $action ) {
			case 'download_debug_data':
				$this->download_debug_data();
				break;
			case 'download_import_logs':
				$this->download_logs( 'import' );
				break;
			case 'download_export_logs':
				$this->download_logs( 'export' );
				break;
		}
	}

	/**
	 * Download logs for given operation type.
	 *
	 * @param string $operation_type Operation type (import/export).
	 * @return void
	 */
	private function download_logs( $operation_type ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'ranksmileseo' ) );
		}

		$logger   = Ranksmile()->get_plugin()->get_ranksmile_logger();
		$log_file = $logger->get_log_file_path( $operation_type );

		if ( ! file_exists( $log_file ) ) {
			wp_die( esc_html__( 'Log file not found.', 'ranksmileseo' ) );
		}

		global $wp_filesystem;
		if ( ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		if ( ! WP_Filesystem() ) {
			wp_die( esc_html__( 'Could not initialize filesystem.', 'ranksmileseo' ) );
		}

		$filename     = 'ranksmile-' . $operation_type . '-logs-' . current_time( 'Y-m-d-H-i-s' ) . '.xml';
		$file_content = $wp_filesystem->get_contents( $log_file );

		if ( false === $file_content ) {
			wp_die( esc_html__( 'Could not read log file.', 'ranksmileseo' ) );
		}

		header( 'Content-Type: application/xml' );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		header( 'Content-Length: ' . filesize( $file_content ) );
		header( 'Connection: close' );

		echo esc_html( $file_content );
		exit;
	}
}
