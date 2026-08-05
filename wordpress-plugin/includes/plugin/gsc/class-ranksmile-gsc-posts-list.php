<?php
/**
 * Class to handle data migration
 *
 * @package Ranksmile
 */

namespace Ranksmile\Plugin\GSC;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class to handle data migration
 */
class Ranksmile_GSC_Posts_List {

	use Ranksmile_GSC_Common;

	/**
	 * Object construct.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'init' ) );
	}

	/**
	 * Init function.
	 */
	public function init() {
		add_filter( 'manage_posts_columns', array( $this, 'register_ranksmile_gsc_data_column' ) );
		add_action( 'manage_posts_custom_column', array( $this, 'render_ranksmile_gsc_data_column' ) );
	}

	/**
	 * Adds column with GSC data to posts and pages list.
	 *
	 * @param array $columns Columns array.
	 * @return array
	 */
	public function register_ranksmile_gsc_data_column( $columns ) {
		$post_type = get_post_type();
		if ( ! in_array( $post_type, ranksmile_return_supported_post_types(), true ) ) {
			return $columns;
		}

		$icon = '<svg style="vertical-align: top; margin-right: 7px;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 226 226" fill="none" aria-hidden="true">
			<path fill-rule="evenodd" clip-rule="evenodd" d="M91.4595 26.5015C102.568 12.8345 123.432 12.8345 134.54 26.5015C140.447 33.7678 149.618 37.5668 158.932 36.6049C176.451 34.7958 191.204 49.5488 189.395 67.0678C188.433 76.382 192.232 85.5535 199.498 91.4595C213.165 102.568 213.165 123.432 199.498 134.54C192.232 140.447 188.433 149.618 189.395 158.932C191.204 176.451 176.451 191.204 158.932 189.395C149.618 188.433 140.447 192.232 134.54 199.498C123.432 213.165 102.568 213.165 91.4595 199.498C85.5535 192.232 76.382 188.433 67.0678 189.395C49.5488 191.204 34.7958 176.451 36.6049 158.932C37.5668 149.618 33.7678 140.447 26.5015 134.54C12.8345 123.432 12.8345 102.568 26.5015 91.4595C33.7678 85.5535 37.5668 76.382 36.6049 67.0678C34.7958 49.5488 49.5488 34.7958 67.0678 36.6049C76.382 37.5668 85.5535 33.7678 91.4595 26.5015ZM73 112.5a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0 -15 0M123 112.5a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0 -15 0M88 125.5C97 141 113 141 122 125.5C119.5 129 98.5 129 88 125.5Z" fill="#1D2327"/>
		</svg>';

		$columns['ranksmile_gsc_traffic_data'] = $icon . __( 'Ranksmile', 'ranksmileseo' );
		return $columns;
	}

	/**
	 * Renders column content for GSC data column.
	 *
	 * @param string $column_id Column ID.
	 */
	public function render_ranksmile_gsc_data_column( $column_id ) {
		if ( 'ranksmile_gsc_traffic_data' !== $column_id ) {
			return;
		}

		echo '<div class="ranksmile-layout">';
		$ranksmile_gsc_connection = Ranksmile()->get_ranksmile_settings()->get_option( 'content-importer', 'ranksmile_gsc_connection', false );
		if ( ! isset( $ranksmile_gsc_connection ) || 1 !== intval( $ranksmile_gsc_connection ) ) {
			echo '<a href="' . esc_attr( admin_url( 'admin.php?page=ranksmile' ) ) . '" class="ranksmile-button ranksmile-button--xsmall ranksmile-button--link">' . esc_html__( 'Add GSC', 'ranksmileseo' ) . '</a>';
		} else {

			$post         = get_post();
			$post_traffic = ranksmile_get_last_post_traffic_by_id( $post->ID );

			if ( $post_traffic ) {
				$this->render_position_monitor_column_values( $post->ID );
			} elseif ( 'publish' !== $post->post_status ) {
				esc_html_e( 'Publish a post to see data from GSC.', 'ranksmileseo' );
			} else {
				esc_html_e( 'Relax while we\'re gathering your data.', 'ranksmileseo' );
			}
		}
		echo '</div>';
	}

	/**
	 * Renders position monitor column values.
	 *
	 * @param int $post_id Post ID.
	 */
	private function render_position_monitor_column_values( $post_id ) {

		$post_performance = ranksmile_get_last_post_traffic_by_id( $post_id );

		$last_update_date     = $this->return_period_based_on_gathering_date( $post_performance['data_gathering_date'] );
		$previous_update_date = $this->return_period_based_on_gathering_date( gmdate( 'Y-m-d', strtotime( 'previous monday', strtotime( $this->get_previous_period_date( $post_id ) ) ) ) );

		$draft_id       = get_post_meta( $post_id, 'ranksmile_draft_id', true );
		$scrape_status  = get_post_meta( $post_id, 'ranksmile_scrape_ready', true );
		$permalink_hash = get_post_meta( $post_id, 'ranksmile_permalink_hash', true );
		$content        = get_the_content( null, false, $post_id );

		$stats = array(
			'clicks'            => $post_performance['clicks'],
			'clicksPrev'        => $post_performance['clicks'] - $post_performance['clicks_change'],
			'position'          => $post_performance['position'],
			'positionPrev'      => $post_performance['position'] - $post_performance['position_change'],
			'impressions'       => $post_performance['impressions'],
			'impressionsPrev'   => $post_performance['impressions'] - $post_performance['impressions_change'],
			'positionWithSufix' => ranksmile_add_numerical_suffix( $post_performance['position'] ),
		);

		ob_start();
			require Ranksmile()->get_basedir() . '/templates/admin/posts-list-gsc-column.php';
		$html = ob_get_clean();

		$additional_allowed_html = array(
			'svg'  => array(
				'xmlns'        => array(),
				'fill'         => array(),
				'viewbox'      => array(),
				'role'         => array(),
				'aria-hidden'  => array(),
				'focusable'    => array(),
				'stroke-width' => array(),
				'stroke'       => array(),
				'class'        => array(),
			),
			'path' => array(
				'd'               => array(),
				'fill'            => array(),
				'stroke-linecap'  => array(),
				'stroke-linejoin' => array(),

			),
			'b'    => array(),
			'br'   => array(),
		);

		echo wp_kses( $html, array_merge( wp_kses_allowed_html( 'post' ), $additional_allowed_html ) );
	}
}
