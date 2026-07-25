jQuery(function ($) {
  var connected = ranksmile_connection_lang.connected

  if (connected) {
    $('.ranksmile-connected').show()
    $('.ranksmile-not-connected').hide()
  } else {
    $('.ranksmile-connected').hide()
    $('.ranksmile-not-connected').show()
  }

  var connection_check

  function check_connection_success() {
    var data = {
      action: 'check_connection_status',
      _ranksmile_nonce: ranksmile_connection_lang._ranksmile_nonce,
    }

    $.ajax({
      url: ranksmile_connection_lang.ajaxurl,
      type: 'POST',
      data: data,
      dataType: 'json',
      async: true,
      success: function (response) {
        if (true === response.connection) {
          $('#ranksmile-connection-spinner').hide()

          $('.ranksmile-connected').show()
          $('.ranksmile-not-connected').hide()

          $('#ranksmile-organization-name').html(
            response.details.organization_name
          )
          $('#ranksmile-via-email').html(response.details.via_email)

          clearInterval(connection_check)
        }
      },
    })
  }

  function make_disconnection() {
    var data = {
      action: 'disconnect_surfer',
      _ranksmile_nonce: ranksmile_connection_lang._ranksmile_nonce,
    }

    $.ajax({
      url: ranksmile_connection_lang.ajaxurl,
      type: 'POST',
      data: data,
      dataType: 'text',
      async: true,
      success: function (response) {
        $('#ranksmile-reconnection-spinner').hide()

        $('.ranksmile-connected').hide()
        $('.ranksmile-not-connected').show()
      },
    })
  }

  function make_connection() {
    var data = {
      action: 'generate_connection_url',
      auth_user_id: $('#ranksmile-auth-user').val(),
      _ranksmile_nonce: ranksmile_connection_lang._ranksmile_nonce,
    }

    $.ajax({
      url: ranksmile_connection_lang.ajaxurl,
      type: 'POST',
      data: data,
      dataType: 'json',
      async: true,
      success: function (response) {
        var win = window.open(response.url, '_blank')
        if (win) {
          connection_check = setInterval(check_connection_success, 5000)
          win.focus()
        } else {
          alert(ranksmile_connection_lang.popup_block_error)
        }
      },
    })
  }

  $('#ranksmile_reconnect').click(function (event) {
    event.preventDefault()

    $('#ranksmile-reconnection-spinner').show()
    make_disconnection()

    $('#ranksmile-connection-spinner').show()
    make_connection()
  })

  $('.ranksmile_make_connection').click(function (event) {
    event.preventDefault()

    $('#ranksmile-connection-spinner').show()
    make_connection()
  })

  $('#ranksmile_disconnect').click(function (event) {
    event.preventDefault()

    $('#ranksmile-reconnection-spinner').show()
    make_disconnection()
  })
})
