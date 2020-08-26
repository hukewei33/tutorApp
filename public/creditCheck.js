//alert("hi");


if (document.readyState == 'loading') {
    document.addEventListener('DOMContentLoaded', ready)
} else {
    ready()
}

function ready() {
    var viewButtons = document.getElementsByClassName('view-info')
    for (var i = 0; i < viewButtons.length; i++) {
        var button = viewButtons[i]
        button.addEventListener('click', creditCheck)
    }
}

function creditCheck(event){
  alert("button clicked")
  var creditString = document.getElementsByClassName("balance")[0].innerText;
  var credit=parseInt(creditString.replace("Account Balance: ",""),10);
  console.log(credit)
  if(credit<1){
    alert("not enough money");
    window.location.replace("http://www.w3schools.com");
    window.location.href = "/buyCredits";
  }
  else{
    alert("enough money");

  }
}
